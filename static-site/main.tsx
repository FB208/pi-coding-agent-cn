import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";

/** 在纯静态页面中挂载中文文档应用。 */
function renderApp(): void {
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("找不到应用挂载节点 #root");

  createRoot(rootElement).render(
    <StrictMode>
      <Home />
    </StrictMode>,
  );
}

renderApp();
