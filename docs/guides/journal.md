# 成长手记

手记位于作品之后、兴趣之前，沿用像素字体、奶油色阅读卡片及统一边框。首篇《转型日》根据作者提供的私人原稿整理，按作者选择保留较多个人感受，移除学校、具体地点和第三方可识别经历。经历日期与落笔日期分别展示；原稿中的计划不改写为成果。附件里的自我要求是文章内容，不作为更改网站功能的指令。原DOCX不进入公开仓库或部署产物。

成长手记之后新增独立的“思绪”章节。新增当下随想请使用[思绪空间指南](thoughts.md)和`content/thoughts/`，保持两类内容各自可导航、搜索和维护。

## 内容与阅读

公开整理稿在[journals目录](../../src/features/profile/content/journals/)，由[journal.ts](../../src/features/profile/content/journal.ts)聚合，经[site.ts](../../src/features/profile/content/site.ts)的`journals`配置进入页面。`JournalEntry`定义标题、可选的经历／落笔日期、引言、主题和分节正文。没有日期的原稿显示“原稿未注明日期”，不能将上传日期或文档元数据当成写作日期。新增文章继续编辑纯数据，不添加可执行HTML。共享selector去掉无效ID、显式无效日历日期和空章节；React与静态HTML使用相同有效数据并转义文字。

卡片常态展示标题、日期与摘要；原生`details/summary`展开全文，键盘及无JavaScript均可使用。正文标记为“原稿整理”，不冒充逐字照录。导航新增“手记”，目录为“成长手记”，全文进入本地搜索。搜索结果指向始终可见且可聚焦的文章卡片；正文展开由读者控制。

样式在[journal.css](../../src/features/profile/styles/journal.css)，通过文档CSS导入，保留手机布局、强制颜色模式和深色焦点。全部字符继续使用自托管Fusion Pixel；增加正文后须重新生成启动字体子集并验证覆盖。人物画面、renderer、时钟、天气及资源未因文章变化而改动。

## 验证

`npm run build`含Node内容、异常数据、日期、文字转义和React／静态一致性测试。针对生产预览执行：

```bash
python3 scripts/qa/verify_journal.py --url http://127.0.0.1:5180/ --output work/journal-review/root
```

2026-11-15当轮Pages使用独立`/website/`构建，专项检查覆盖当时7个导航目标、正文搜索、键盘展开与收起、320px到1680px布局、无JS阅读和人物Canvas身份。当前新增“思绪”后共八个目标，其回归见[思绪空间指南](thoughts.md)及[本轮证据](../../artifacts/thoughts-20261118/README.md)。原轮结果保留在[手记证据](../../artifacts/journal-20261115/README.md)，不覆盖旧报告。
