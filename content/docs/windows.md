# Windows

Pi 在 Windows 上需要一个 bash shell。系统按以下顺序检查：

1. `~/.pi/agent/settings.json` 中定义的自定义路径
2. Git Bash（`C:\Program Files\Git\bin\bash.exe`）
3. PATH 中的任何 `bash.exe`（支持 Cygwin、MSYS2 或 WSL）

对于大多数用户，[Git for Windows](https://git-scm.com/download/win) 就足够了。

## 自定义 Shell 路径

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```
