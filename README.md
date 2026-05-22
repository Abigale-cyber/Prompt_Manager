# Prompt Management Tool

本地 Prompt 管理小工具雏形。当前主方向是 Swift/AppKit 原生 Mac 壳 + Figma 导出的 React UI，不依赖 Tauri，也不需要 Rust。

## 当前能力

- Prompt 分类、搜索、列表展示
- 新增、编辑、删除 Prompt
- 点击调用时复制 Prompt，并记录使用次数
- 使用 WebView `localStorage` 本地保存数据
- 菜单栏入口
- 全局快捷键 `⌥Space` 在当前 App 上方浮出完整 Prompt 管理器界面
- 弹出时优先避开当前聚焦输入框，尽量放到输入框上方或下方
- 会记住用户手动调整后的窗口大小和位置
- 默认浮窗尺寸为 `640 x 460`，并优先靠右显示
- 调用 Prompt 后复制到剪贴板，并尝试切回原 App 自动粘贴
- 以菜单栏后台工具运行，默认不打开完整管理窗口

`⌥Space` 是 macOS 标准全局快捷键。只复制 Prompt 不需要额外权限；如果要自动粘贴到其他 App 的输入框，需要给 App 开启辅助功能权限。

## 运行 Mac 小工具

```bash
tools/prompt-manager-mac/build.sh
open tools/prompt-manager-mac/build/PromptManager.app
```

`build.sh` 会先执行 `npm run build`，再把 `dist/` 里的 React 页面打包进 `.app` 的 `Contents/Resources/web/`。

生成的 App：

```text
tools/prompt-manager-mac/build/PromptManager.app
```

## 前端原型预览

React/Vite 页面仍保留为视觉原型参考：

```bash
npm install
npm run dev
```

访问 `http://127.0.0.1:1420/`。
