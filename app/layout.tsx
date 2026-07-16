import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Pi 中文文档",
  description: "Pi Coding Agent 非官方简体中文文档，涵盖安装、配置、自定义和编程式使用。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="zh-CN" suppressHydrationWarning><body>{children}</body></html>;
}
