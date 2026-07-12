# BiliRandomizer

一个轻量的 Windows 桌面播放器：同步多个 Bilibili 收藏夹，将它们合并为曲库，并进行纯随机或收藏夹均衡随机播放。

## 功能

- 同步多个 B 站收藏夹，支持分页拉取和 BVID 去重
- 纯随机与收藏夹均衡随机
- 播放历史、曲库统计、歌曲搜索
- 自动下一首、弹幕/画质选项、音频界面
- Tauri 迷你 CD 窗口与窗口置顶
- SESSDATA 保存到 Windows 凭据管理器，不写入 localStorage

## 本地开发

需要 Node.js、Rust stable 和 Windows WebView2 开发环境。

```bash
npm install
npm run dev
```

类型检查和测试：

```bash
npm run lint
npm test
```

## 构建

```bash
npm run build
```

安装包生成在 `src-tauri/target/release/bundle/`。推送 `v*` 标签或手动运行 GitHub Actions 也会生成 Windows 安装包和便携版。

## SESSDATA

私有收藏夹或需要登录权限的接口可能需要 SESSDATA。它属于登录凭据，请勿分享。应用仅在桌面端运行，并通过 Windows 凭据管理器保存该值。
