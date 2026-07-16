// 在 Windows 与类 Unix 系统上统一启动 Vinext，并注入 Wrangler 日志路径。
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const command = process.platform === "win32"
  ? join(process.cwd(), "node_modules", ".bin", "vinext.cmd")
  : join(process.cwd(), "node_modules", ".bin", "vinext");
const result = spawnSync(command, process.argv.slice(2), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
});
process.exit(result.status ?? 1);
