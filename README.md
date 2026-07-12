<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/4c13ec82-f33d-4867-b123-f9d1ed832d4c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## 🖥️ Standalone Desktop App (Tauri) / Windows .exe 桌面版

我们已经引入了全新的 **Tauri** 框架，允许你脱离浏览器，将此播放器一键打包为独立的 Windows `.exe` 绿色版软件。同时增加了原生 **窗口置顶 (Always on Top)** 极赞挂机功能！

### 🚀 方式 A：GitHub Actions 自动云打包（最推荐，一键发布）

你无需在自己的电脑上安装 Rust 或复杂的 Windows 编译环境，我们已配置好自动化 CI/CD 流程：
1. **推送版本标签**：在 Git 中创建一个以 `v` 开头的标签并推送（如 `v1.0.4`）：
   ```bash
   git tag v1.0.4
   git push origin v1.0.4
   ```
2. **手动触发**：进入你的 GitHub 仓库的 **Actions** 标签页，选中 **Build Desktop Release** 工作流，点击 **Run workflow** 手动触发打包。
3. **下载软件**：大约 5-10 分钟后，打包完成，你可以在 GitHub 仓库的 **Releases** 页面直接下载打包好的 Windows `.exe` 或 `.msi` 绿色安装包！

---

### 💻 方式 B：本地开发与打包（在 Windows 电脑上运行）

如果你想在本地编译、调试或预览：

#### 1. 安装本地开发环境
- 安装 [Node.js](https://nodejs.org/) (建议 v18+)
- 安装 [Rust 编译器](https://www.rust-lang.org/tools/install) (选择 Windows x64 MSVC 工具链)

#### 2. 开发预览
```bash
npm run tauri dev
```
此命令会启动原生桌面播放器窗口，并热重载 React 界面。

#### 3. 本地打包为 .exe
```bash
npm run tauri build
```
打包完成后，软件的 `.exe` 可执行安装包将生成在：
`src-tauri/target/release/bundle/msi/BiliRandomizer_1.0.4_x64_zh-CN.msi`
以及绿色单文件版本。

