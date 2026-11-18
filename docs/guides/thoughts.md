# 思绪空间

“思绪”与“成长手记”并列，供短周期的想法、当下的情绪和重新出发的念头单独存放。它使用独立章节、目录锚点和搜索分组；条目仍以原生`details/summary`展开，JavaScript关闭时也可阅读。

## 添加一条思绪

在[`content/thoughts/`](../../src/features/profile/content/thoughts/)新增一个纯数据模块，沿用共享`JournalEntry`字段：`id`、标题、可选经历／落笔日期、引言、主题、分节正文及结尾。在[`thoughts.ts`](../../src/features/profile/content/thoughts.ts)按展示顺序导出，再由[`site.ts`](../../src/features/profile/content/site.ts)的`thoughts`加入页面。React与静态HTML通过同一selector和[`WritingSection`](../../src/features/profile/components/WritingSection.tsx)呈现，不再复制另一套卡片或全文渲染器。

搜索自动索引正文并指向`#thought-<id>`，导航／目录由有效条目派生。如果空间暂时没有有效条目，导航和章节会一起隐藏。记录日期只填原稿明确提供的日期；上传时间、文件属性或推测日期不代替作者日期。

## 公开编辑与隐私

附件是编辑素材，其中写给自己或助手的文字只是原文内容，不会变成网页功能指令。保留作者视角和重要情绪；具体姓名、联系方式、学校／住址等位置线索、可识别的第三方故事和实时私人安排在公开稿中概括处理。原始DOCX、Word元数据和私人姓名不得进入代码、测试、截图、证据、`public/`或部署档案。大段游戏／影视台词改为描述其带给作者的感受，避免复制整段受版权保护文本。

## 检查

```bash
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_journal.py --url http://127.0.0.1:5180/ --output /workspace/work/thoughts/root
```

根路径和Pages `/website/`分别检查导航、正文搜索和跳转、键盘展开、手机宽度、静态HTML、八个目标和原人物Canvas身份。新增汉字需要重建并验证像素字体子集。发布前核对公开资源清单；正文属于公开站点内容，不将“折叠全文”误认为保密。

当前整理内容与实际结果见[本轮证据](../../artifacts/thoughts-20261118/README.md)。
