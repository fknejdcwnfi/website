# 思绪与日志

「思绪与日志」把较长的阶段记录和当下想法放在同一处，使用“日志／思绪”小标签保留内容差异。它共用一个章节、目录入口、搜索分组和阅读卡片；文章仍可直接通过既有锚点访问。人物与Minecraft场景不参与这组内容的渲染。

## 内容与数据

- 在[`content/writing/logs/`](../../src/features/profile/content/writing/logs/)维护日志，在[`content/writing/thoughts/`](../../src/features/profile/content/writing/thoughts/)维护思绪；共享[`WritingEntry`](../../src/features/profile/content/types.ts)数据结构。
- [`writing/index.ts`](../../src/features/profile/content/writing/index.ts)显式维护阅读顺序。当前先展示有日期的较新记录，再展示没有日期的《学会与时俱进》；未提供的日期不得从文件属性或上传时间推断。
- `kind`只允许`log`与`thought`。条目需要有效小写ID、非空标题及至少一个完整章节。同一类别内重复ID只保留首条。日志和思绪可使用相同ID，因为分类前缀会生成不同锚点。selector会剔除无效类别、重复ID、无效日期和空段落。卡片省略重复的类别标签，搜索仍可匹配它。React以文本节点渲染，静态HTML对所有作者文字转义。
- 卡片使用原生`details/summary`；关闭JavaScript时，主要内容和全文阅读仍可用。折叠全文仍会随页面公开，不是隐私保护。
- 日期分别标为经历日期和落笔日期。没有原稿支持的日期保持缺省，静态和动态页面都显示“原稿未注明日期”。
- 两篇或以上时显示本栏索引。链接用文章标题和原生锚点，移动端保持至少44px的可点击高度。索引和卡片共用排序与标题，关闭JavaScript也可跳转。

## 搜索与兼容

[`getWritingEntries`](../../src/features/profile/content/selectors.ts)是React、静态HTML、目录、导航和搜索共用的有效数据入口。首次打开搜索时，当前挂载建立并缓存全文索引。思绪和日志结果归到同一「思绪与日志」分组。页面导航和目录也在挂载期间复用，滚动和暂停时可直接使用。

新条目锚点由分类生成：日志使用`#note-<id>`，思绪使用`#thought-<id>`。已经发布的锚点继续保留；旧的`#journal`和`#thoughts`章节链接也定位到共享栏目。新增条目应保持ID稳定，以免已有外部书签失效。

[`writingPresentation.ts`](../../src/features/profile/content/writingPresentation.ts)提供索引链接、日期、类别和章节标识。内部标题使用双连字符，与公开的文章锚点区分。卡片与索引样式位于[`writing.css`](../../src/features/profile/styles/writing.css)。React和无JavaScript结构由[`WritingSection.tsx`](../../src/features/profile/components/WritingSection.tsx)与[`staticMarkup.ts`](../../src/features/profile/content/staticMarkup.ts)共同维护。增加中文字后运行`npm run assets:font:check`。缺少子集字形时按[`Fusion Pixel流程`](../../scripts/README.md)重新生成并验证。

## 运行验证

```bash
npm run build
npm run assets:check
npm run assets:verify
python3 scripts/qa/verify_writing.py --url http://127.0.0.1:5180/ --output /workspace/work/unified-writing-20261118/writing-root
```

专项检查覆盖两种内容分类、同一导航和搜索组、原文章锚点、日期、键盘全文阅读、320至1680像素布局、无JavaScript内容、卡片边框、搜索焦点及动态人物Canvas身份。Sites根路径和Pages`/website/`需分别构建、预览。实际通过结果只写入当轮独立证据，不从旧报告推断。
