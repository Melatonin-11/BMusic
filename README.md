# BiliRandomizer

BiliRandomizer 是一款轻量的 Windows 桌面播放器。它可以同步多个 Bilibili 收藏夹，将歌曲合并为一个曲库，并以纯随机或收藏夹均衡随机的方式播放。

## 主要功能

- 同步多个 B 站收藏夹，支持分页拉取与 BVID 去重
- 自由选择参与融合曲库的收藏夹
- 纯随机与收藏夹均衡随机
- 播放历史、曲库统计、歌曲搜索和使用时长统计
- 自动下一首、弹幕与画质选项、纯音频界面
- Tauri 极简 CD 悬浮窗、窗口置顶和位置记忆
- 使用 Windows 凭据管理器保存 SESSDATA，不写入 localStorage
- 启动时检查新版本，并在应用内完成下载、验签、安装和重启

## 项目结构

```text
.
├─ .github/workflows/       GitHub Actions 发布流程
├─ src/
│  ├─ components/           React 页面与界面组件
│  ├─ utils/                播放、同步、导入和本地存储逻辑
│  ├─ App.tsx               应用状态与页面入口
│  └─ types.ts              共用数据类型
├─ src-tauri/
│  ├─ capabilities/         Tauri 权限配置
│  ├─ icons/                Windows 安装包和窗口图标
│  ├─ src/main.rs           桌面端命令、窗口和安全存储逻辑
│  └─ tauri.conf.json       桌面应用与自动更新配置
├─ tests/                   核心逻辑测试
├─ index.html               前端 HTML 入口
├─ package.json             Node.js 脚本与依赖
└─ vite.config.ts           Vite 构建配置
```

`node_modules/`、`dist/` 和 `src-tauri/target/` 都是可重新生成的本地产物，已被 Git 忽略，不应提交。

## 本地开发

需要 Node.js、Rust stable、Windows WebView2 和 Tauri 的 Windows 构建依赖。

```bash
npm install
npm run dev
```

检查类型、测试核心逻辑和构建前端：

```bash
npm run lint
npm test
npm run build:frontend
```

## 构建与发布

```bash
npm run build
```

安装包会生成在 `src-tauri/target/release/bundle/`。推送 `v*` 标签后，GitHub Actions 会构建 Windows 安装包、便携版和自动更新文件，并创建对应的 GitHub Release。

## 自动更新签名

自动更新包必须使用固定私钥签名。仓库的 GitHub Actions 需要配置以下 Repository Secret：

- 名称：`TAURI_SIGNING_PRIVATE_KEY`
- 内容：完整的 Tauri 更新签名私钥

私钥不能提交到 Git，也不能丢失；应用内置的公钥仅用于验证更新包，可以公开。首次安装支持自动更新的版本仍需手动完成，之后可通过顶部的“检查更新”入口直接在应用内更新。

## SESSDATA 安全提示

私有收藏夹或需要登录权限的接口可能需要 SESSDATA。它属于登录凭据，请勿分享。应用仅在桌面端运行，并通过 Windows 凭据管理器保存该值。
