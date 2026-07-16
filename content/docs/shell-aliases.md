# Shell 别名

Pi 以非交互模式（`bash -c`）运行 bash，默认不会展开别名。

要使 shell 别名生效，在 `~/.pi/agent/settings.json` 中添加：

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\neval \"$(grep '^alias ' ~/.zshrc)\""
}
```

根据你的 shell 配置文件调整路径（如 `~/.zshrc`、`~/.bashrc` 等）。
