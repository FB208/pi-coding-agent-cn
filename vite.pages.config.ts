import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** 根据 GitHub 仓库名称生成 Pages 子路径，本地开发时使用根路径。 */
function getPagesBase(): string {
  if (!process.env.GITHUB_ACTIONS) return "/";

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  if (!repositoryName || repositoryName.endsWith(".github.io")) return "/";
  return "/" + repositoryName + "/";
}

export default defineConfig({
  base: getPagesBase(),
  root: "static-site",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
