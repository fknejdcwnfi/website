# 思绪与日志合并验证

本轮将原独立的成长手记和思绪入口合并为单一「思绪与日志」栏目，保留三篇公开整理稿、日期语义、全文、搜索、可展开阅读和旧文章哈希。日志／思绪通过小标签区分；冗余的类别主题芯片只从卡片展示中省略，全文搜索仍索引原标签。

页面导航、目录、搜索分组、React和预渲染HTML共享同一内容selector。旧`#journal`与`#thoughts`链接会跳到合并栏目，文章锚点`#note-*`和`#thought-*`保持不变。新数据位于`src/features/profile/content/writing/`，CSS和验证工具也已使用共享命名；旧QA文件保留为兼容入口。人物Canvas、Minecraft场景和默认动态播放没有改动。

## 验证结果

- `npm run build`：严格TypeScript构建通过，包含的161项Node测试全通过。
- `npm run assets:check`、`npm run assets:verify`：来源／派生资源、字体覆盖、公开资源清单和仓库链接验证通过；18项结构测试通过，735条受支持的相对Markdown链接均检查，已知冻结参考文档的7个旧链接继续单独记录。
- `verify_writing.py`：Sites根路径`/`与GitHub Pages子路径`/website/`各42项通过。覆盖分类、日期、统一搜索组、旧锚点、键盘、无JS、稳定卡片样式、320至1680px视口和同一人物Canvas。
- `verify_reading_theme.py` 24项、`verify_cream_scenic_ui.py`根路径及子路径各155项、`verify_profile_modules.py` 283项、`verify_scenic_motion.py` 35项通过。
- `verify_audit_hardening.py`根路径及子路径各118项通过，检查CSP、错误边界、搜索跳转及隔离故障注入。
- 根路径与Pages子路径各进行一次独立1440×1000、DPR 1的本地Chromium资源观察：只请求同源资源、没有浏览器错误或失败响应，也没有请求历史归档运行时代码；已解码的装饰资源合计3,445,496字节。

以上资源数字是本地单次测量的解码资源大小，不是压缩后的互联网传输量、真实访客CWV或设备性能保证。本轮没有新增依赖或远程资源，也没有建立可比的前后性能基线，因此不声称量化的访客性能提升。全量修改稿在静态HTML及本地搜索索引中公开；折叠全文只影响呈现，不提供隐私保护。

## 预览图

桌面日志卡片：

![思绪与日志的像素风日志卡片](screenshots/log-card-desktop.png)

手机思绪卡片：

![思绪与日志的像素风手机思绪卡片](screenshots/thought-card-mobile.png)

## 原始检查报告

`checks/`保留对应基础路径和浏览器运行的机器可读报告；本目录不包含用户上传的原始文档。以上报告描述本轮本地构建，不代替GitHub Actions部署或Sites正式发布验证。
