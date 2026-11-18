# 思绪与日志

「思绪与日志」把较长的阶段记录和当下想法放在同一处，使用“日志／思绪”小标签保留内容差异。它共用一个章节、目录入口、搜索分组和阅读卡片；文章仍可直接通过既有锚点访问。人物与Minecraft场景不参与这组内容的渲染。

## 内容与数据

- 在[`content/writing/logs/`](../../src/features/profile/content/writing/logs/)维护日志，在[`content/writing/thoughts/`](../../src/features/profile/content/writing/thoughts/)维护思绪；共享[`WritingEntry`](../../src/features/profile/content/types.ts)数据结构。
- [`writing/index.ts`](../../src/features/profile/content/writing/index.ts)显式维护阅读顺序。当前先展示有日期的较新记录，再展示没有日期的《学会与时俱进》；未提供的日期不得从文件属性或上传时间推断。
- `kind`只允许`log`与`thought`。条目需要有效小写ID、非空标题及至少一个完整章节。同一类别内重复ID只保留首条；日志和思绪可使用相同ID，因为分类前缀会生成不同锚点。selector会剔除无效类别、重复ID、无效日期和空段落；分类标签已经展示的类别名不会再作为重复主题标签渲染，但仍可搜索。React以文本节点渲染，静态HTML对所有作者文字转义。
- 卡片使用原生`details/summary`；关闭JavaScript时，主要内容和全文阅读仍可用。折叠全文仍会随页面公开，不是隐私保护。
- 日期分别标为经历日期和落笔日期。没有原稿支持的日期保持缺省，静态和动态页面都显示“原稿未注明日期”。

## 搜索与兼容

[`getWritingEntries`](../../src/features/profile/content/selectors.ts)是React、静态HTML、目录、导航和搜索共用的有效数据入口。全文按原实现进入每次挂载时生成的本地搜索索引；思绪和日志结果归到同一「思绪与日志」分组。

新条目锚点由分类生成：日志使用`#note-<id>`，思绪使用`#thought-<id>`。已经发布的锚点继续保留；旧的`#journal`和`#thoughts`章节链接也定位到共享栏目。新增条目应保持ID稳定，以免已有外部书签失效。

卡片样式在[`writing.css`](../../src/features/profile/styles/writing.css)，日期显示在[`writingPresentation.ts`](../../src/features/profile/content/writingPresentation.ts)。React和无JavaScript结构由[`WritingSection.tsx`](../../src/features/profile/components/WritingSection.tsx)与[`staticMarkup.ts`](../../src/features/profile/content/staticMarkup.ts)共同维护。增加中文字后运行`npm run assets:font:check`；缺少子集字形时按[`Fusion Pixel流程`](../../scripts/README.md)重新生成并验证，不替换完整字体或许可证。

## 运行验证

```bash
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_writing.py --url http://127.0.0.1:5180/ --output /workspace/work/unified-writing-20261118/writing-root
```

专项检查覆盖两种内容分类、同一导航和搜索组、原文章锚点、日期、键盘全文阅读、320至1680像素布局、无JavaScript内容、卡片边框、搜索焦点及动态人物Canvas身份。Sites根路径和Pages`/website/`需分别构建、预览。实际通过结果只写入当轮独立证据，不从旧报告推断。
