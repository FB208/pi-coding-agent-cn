# 快捷键

所有键盘快捷键都可通过 `~/.pi/agent/keybindings.json` 自定义。每个操作可以绑定一个或多个按键。

配置文件使用与 pi 内部相同的带命名空间键绑定 ID，扩展作者在 `keyHint()` 和注入的 `keybindings` 管理器中也使用这些 ID。

使用 `cursorUp` 或 `expandTools` 等旧版无命名空间 ID 的配置，会在启动时自动迁移为带命名空间的 ID。

编辑 `keybindings.json` 后，在 pi 中运行 `/reload`，无需重启会话即可应用更改。

## 按键格式

格式为 `modifier+key`。修饰键包括 `ctrl`、`shift`、`alt`（可以组合），按键包括：

- **字母：** `a-z`
- **数字：** `0-9`
- **特殊键：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **功能键：** `f1`-`f12`
- **符号：** `` ` ``、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、`%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

修饰键组合示例：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`ctrl+1` 等。

## 所有操作

### TUI 编辑器光标移动

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `tui.editor.cursorUp` | `up` | 光标上移 |
| `tui.editor.cursorDown` | `down` | 光标下移 |
| `tui.editor.cursorLeft` | `left`、`ctrl+b` | 光标左移 |
| `tui.editor.cursorRight` | `right`、`ctrl+f` | 光标右移 |
| `tui.editor.cursorWordLeft` | `alt+left`、`ctrl+left`、`alt+b` | 光标向左移动一个单词 |
| `tui.editor.cursorWordRight` | `alt+right`、`ctrl+right`、`alt+f` | 光标向右移动一个单词 |
| `tui.editor.cursorLineStart` | `home`、`ctrl+a` | 移至行首 |
| `tui.editor.cursorLineEnd` | `end`、`ctrl+e` | 移至行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | 向前跳至字符 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | 向后跳至字符 |
| `tui.editor.pageUp` | `pageUp` | 向上滚动一页 |
| `tui.editor.pageDown` | `pageDown` | 向下滚动一页 |

### TUI 编辑器删除

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `tui.editor.deleteCharBackward` | `backspace` | 向后删除字符 |
| `tui.editor.deleteCharForward` | `delete`、`ctrl+d` | 向前删除字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`、`alt+backspace` | 向后删除单词 |
| `tui.editor.deleteWordForward` | `alt+d`、`alt+delete` | 向前删除单词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | 删除至行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | 删除至行尾 |

### TUI 输入

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `tui.input.newLine` | `shift+enter`、`ctrl+j` | 插入新行 |
| `tui.input.submit` | `enter` | 提交输入 |
| `tui.input.tab` | `tab` | Tab / 自动补全 |

### TUI 删除环

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `tui.editor.yank` | `ctrl+y` | 粘贴最近删除的文本 |
| `tui.editor.yankPop` | `alt+y` | 粘贴后循环切换已删除文本 |
| `tui.editor.undo` | `ctrl+-` | 撤销上一次编辑 |

### TUI 剪贴板和选择

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `tui.input.copy` | `ctrl+c` | 复制选中内容 |
| `tui.select.up` | `up` | 向上移动选择 |
| `tui.select.down` | `down` | 向下移动选择 |
| `tui.select.pageUp` | `pageUp` | 在列表中向上翻页 |
| `tui.select.pageDown` | `pageDown` | 在列表中向下翻页 |
| `tui.select.confirm` | `enter` | 确认选择 |
| `tui.select.cancel` | `escape`、`ctrl+c` | 取消选择 |

### 应用程序

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `app.interrupt` | `escape` | 取消 / 中止 |
| `app.clear` | `ctrl+c` | 清空编辑器 |
| `app.exit` | `ctrl+d` | 退出（编辑器为空时） |
| `app.suspend` | `ctrl+z`（Windows 上无） | 挂起到后台 |
| `app.editor.external` | `ctrl+g` | 在外部编辑器中打开（`externalEditor`、`$VISUAL`、`$EDITOR`、Windows 上的记事本或其他平台上的 `nano`） |
| `app.clipboard.pasteImage` | `ctrl+v`（Windows 上为 `alt+v`） | 从剪贴板粘贴图片 |

### 会话

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `app.session.new` | *（无）* | 开始新会话（`/new`） |
| `app.session.tree` | *（无）* | 打开会话树导航器（`/tree`） |
| `app.session.fork` | *（无）* | 分叉当前会话（`/fork`） |
| `app.session.resume` | *（无）* | 打开会话恢复选择器（`/resume`） |
| `app.session.togglePath` | `ctrl+p` | 切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | 切换排序模式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | 切换仅显示命名会话的筛选器 |
| `app.session.rename` | `ctrl+r` | 重命名会话 |
| `app.session.delete` | `ctrl+d` | 删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | 查询为空时删除会话 |

### 模型和思考

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `app.model.select` | `ctrl+l` | 打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | 循环到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p` | 循环到上一个模型 |
| `app.thinking.cycle` | `shift+tab` | 循环切换思考级别 |
| `app.thinking.toggle` | `ctrl+t` | 折叠或展开思考块 |

### 显示和消息队列

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `app.tools.expand` | `ctrl+o` | 折叠或展开工具输出 |
| `app.message.copy` | `ctrl+x` | 复制最后一条助手消息，或 `/tree` 中所选的消息 |
| `app.message.followUp` | `alt+enter` | 将后续消息加入队列 |
| `app.message.dequeue` | `alt+up` | 将排队消息恢复到编辑器 |

### 树状导航

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`、`alt+left` | 折叠当前分支区段，或跳到上一段起点 |
| `app.tree.unfoldOrDown` | `ctrl+right`、`alt+right` | 展开当前分支区段，或跳到下一段起点或分支末尾 |
| `app.tree.editLabel` | `shift+l` | 编辑所选树节点上的标签 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | 切换树中的标签时间戳 |
| `app.tree.filter.default` | `ctrl+d` | 将树筛选器设为默认视图 |
| `app.tree.filter.noTools` | `ctrl+t` | 切换隐藏工具结果的树筛选器 |
| `app.tree.filter.userOnly` | `ctrl+u` | 切换仅显示用户消息的树筛选器 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | 切换仅显示带标签条目的树筛选器 |
| `app.tree.filter.all` | `ctrl+a` | 切换显示所有条目的树筛选器 |
| `app.tree.filter.cycleForward` | `ctrl+o` | 向前循环切换树筛选器 |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | 向后循环切换树筛选器 |

### 限定范围的模型选择器

在通过 `/scoped-models` 打开的限定范围模型选择器中使用。

| 键绑定 ID | 默认值 | 说明 |
|--------|---------|-------------|
| `app.models.save` | `ctrl+s` | 将当前模型选择保存到设置 |
| `app.models.enableAll` | `ctrl+a` | 启用所有模型（或所有与当前搜索匹配的模型） |
| `app.models.clearAll` | `ctrl+x` | 清除所有模型（或所有与当前搜索匹配的模型） |
| `app.models.toggleProvider` | `ctrl+p` | 切换当前提供商的所有模型 |
| `app.models.reorderUp` | `alt+up` | 将所选模型在循环顺序中上移 |
| `app.models.reorderDown` | `alt+down` | 将所选模型在循环顺序中下移 |

## 自定义配置

创建 `~/.pi/agent/keybindings.json`：

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "tui.editor.deleteWordBackward": ["ctrl+w", "alt+backspace"]
}
```

每个操作可以使用单个按键或按键数组。用户配置会覆盖默认值。

在原生 Windows 上，`app.suspend` 没有默认绑定，因为 Windows 终端不支持 Unix 作业控制。如果手动绑定它，pi 会显示状态消息而不是挂起。在 WSL 中，常规 Linux `ctrl+z`/`fg` 行为仍然适用。

### Emacs 示例

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "tui.editor.cursorLeft": ["left", "ctrl+b"],
  "tui.editor.cursorRight": ["right", "ctrl+f"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+f"],
  "tui.editor.deleteCharForward": ["delete", "ctrl+d"],
  "tui.editor.deleteCharBackward": ["backspace", "ctrl+h"],
  "tui.input.newLine": ["shift+enter", "ctrl+j"]
}
```

### Vim 示例

```json
{
  "tui.editor.cursorUp": ["up", "alt+k"],
  "tui.editor.cursorDown": ["down", "alt+j"],
  "tui.editor.cursorLeft": ["left", "alt+h"],
  "tui.editor.cursorRight": ["right", "alt+l"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+w"]
}
```
