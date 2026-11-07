# 暮色像素世界 UI 验证 — 2026-11-07

本轮证据对应用户提供的四张参考图所要求的界面更新。原人物动画、原工程、图集、播放器和天气实现均未修改；装饰资源独立位于 `public/assets/pixel-ui/`。

- `build.log`：本轮 109 项 Node 测试、严格 TypeScript 与 Sites 根路径生产构建通过。
- `checks.json`：新 UI 的 53 项浏览器检查通过，包含六个栏目高亮、侧栏／目录同步、切换栏目保留同一 canvas／video、320／390／768／1100／1200／1440／1672px 布局、表格不裁切、导航不溢出、无 JS 与资源响应。
- `profile-checks.json`：本轮重新执行的 269 项页面／独立配置夹具检查通过，包括搜索、复制成功与拒绝、可选账号留空、手机、无 JS、雪樱与人物持续播放。
- `scene-checks.json`：本轮重新执行的 134 项完整场景检查通过，包括 22 个原帧／过渡像素样本、同节点入口接手、独立雪樱、减弱动态、故障恢复和 DPR／调整尺寸。
- `pages-base.json`：另建 `/website/` 生产版本后，实际 Chromium 检查样式、人物和新背景／封面均从正确子路径加载，无浏览器错误或失败资源响应。
- 两项现有资产命令 `npm run assets:check`、`npm run assets:verify` 通过；85 个公开资源与 `dist/` 逐字节一致。

本次合计 456 项浏览器检查。浏览器为环境中现有 Chromium，以上结果不代表实体屏幕 FPS 或所有访客网络条件。

截图：`home-desktop.png`、`about-desktop.png`、`interests-desktop.png`、`contact-desktop.png` 为 1672×941；`home-mobile.png`、`interests-mobile.png` 为 390px 宽；`no-javascript.png` 为真实禁用 JS 的完整页面。生成装饰图不是人物原始素材，也不是游戏账号、玩家战绩或个人事实。

GitHub CI、Pages 与 Sites 发布状态通过各平台返回结果单独核对；本文件只记录构建与浏览器验收。
