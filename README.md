# Prompt Manager

Prompt Manager 是一个本地 Prompt 管理工具。它可以把常用 Prompt 按分类保存起来，在当前软件上方悬浮打开，填写变量后复制或自动粘贴到正在使用的输入框。

## 下载安装

安装包由 GitHub Actions 自动构建，并发布到 GitHub Releases：

| 系统 | 安装包 | 下载 |
|---|---|---|
| Mac | `PromptManager-macOS.dmg` | [下载 Mac 安装包](https://github.com/Abigale-cyber/Prompt_Manager/releases/latest/download/PromptManager-macOS.dmg) |
| Windows | `PromptManager-Windows-x64.exe` | [下载 Windows 安装包](https://github.com/Abigale-cyber/Prompt_Manager/releases/latest/download/PromptManager-Windows-x64.exe) |

如果下载链接暂时不可用，说明最新构建还没有完成。可以打开仓库顶部的 **Actions**，进入最新成功的 **Build Installers** 工作流，在页面底部 **Artifacts** 下载对应安装包。

## Mac 安装

1. 下载 `PromptManager-macOS.dmg`。
2. 打开 `PromptManager-macOS.dmg`。
3. 把 `PromptManager.app` 拖到 `Applications`。
4. 从 `Applications` 启动 `PromptManager.app`。

当前 DMG 未做 Apple Developer ID 公证。第一次打开时，如果 macOS 提示无法验证开发者，右键点击 `PromptManager.app`，选择“打开”，再确认一次。

## Windows 安装

1. 下载 `PromptManager-Windows-x64.exe`。
2. 运行 `PromptManager-Windows-x64.exe`。
3. 按安装向导完成安装。
4. 从开始菜单或桌面快捷方式启动 `Prompt Manager`。

## 使用方法

- 点击 `+` 新增 Prompt，按分类保存常用内容。
- Prompt 中可以使用 `{{字段名}}` 标记调用前需要填写的变量。
- 点击“调用”后，先填写变量，再把生成后的 Prompt 复制或发送到当前软件。
- 在设置里配置模型 API Key 后，可以用“AI填入字段”把关键词改写成字段内容。
- “上一次调用”会恢复同一个 Prompt 最近一次 AI 填入的字段值。
- Mac 端可以使用 `⌥Space` 在当前软件上方唤出工具。

## 本地数据

数据保存在本机浏览器存储中，不会上传到服务器。更换电脑或清理浏览器数据前，点击“导出 Excel”，选择“导出历史记录”备份当前 Prompt 库；到新电脑后再用“导入Excel”恢复。需要空白填写表时，选择“导出模板”。
