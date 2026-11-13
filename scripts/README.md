# 工具入口

从仓库根目录执行，Node版本见`.nvmrc`。当前运行入口是`poeticPixel`圆形场景与`profile`网站；奶油色主题和本地搜索有独立浏览器检查。目录责任与发布规则见[仓库维护](../docs/guides/repository-maintenance.md)。

| 目录 | 责任 |
| --- | --- |
| `assets/` | 衍生素材导出、来源与文件完整性验证 |
| `build/` | 生产HTML安全策略及固定启动脚本哈希 |
| `tests/` | Node内建行为测试；`npm test`的列表以package.json为准 |
| `qa/` | 实际浏览器、像素、导航、个人模块夹具、截图与独立性能观察 |
| `deploy/` | 用户明确另行要求时使用的gh-pages手动备用流程 |

## 构建与资源

```bash
npm ci
npm run dev
npm run build
npm run assets:check
npm run assets:verify
npm run assets:ui:check
npm run assets:font:check
npm run repo:verify
npm run preview -- --host 127.0.0.1 --port 5180
```

`build`经`prebuild`运行Node测试，再做strict TypeScript和Vite生产打包。默认预览为`http://127.0.0.1:5180/website/`；Sites根路径构建使用`VITE_BASE=/ npm run build`。两种基础路径需分别验证，不靠全局修改默认base切换。

`assets:check`核对既有WebP衍生素材；`assets:verify`串接当前和历史资产的来源、清单与哈希验证。它们保留历史完整性，不表示旧renderer仍是首页默认。

六张页面装饰由`assets/optimize_pixel_ui.py`生成lossless WebP并保留PNG。`--verify`只用Python标准库核对清单／哈希／图片头／尺寸，已纳入`assets:verify`，不增加CI依赖；`assets:ui:check`需要Pillow，并额外逐字节比较解码RGBA。正常Node构建不需要Pillow。

`repo:verify`离线检查相对Markdown路径、冻结参考文件哈希及误跟踪的work／dist／依赖／缓存输出；已接入既有`assets:verify`，不改workflow。它单列7处冻结历史旧路径，不检查外部URL或片段，也不在PR检查阶段禁止临时分支。

结构检查先运行18项隔离CLI回归，再检查当前仓库；显式退出码在Python优化模式仍生效。它支持有限的参考式链接并跳过代码，不宣称完整CommonMark解析。字体`prepare_pixel_font.py --verify`是标准库CI检查；`assets:font:check`另需fontTools及Brotli作者工具，比较原字体／子集全部输出轮廓和度量。新增源码字符缺少覆盖时应重新生成子集，保留完整字体和许可证。

## 当前浏览器检查

先对选定基础路径完成构建和preview。每轮显式指定新的`--output`，下面的`YYYYMMDD`替换为本轮日期或唯一任务名。脚本会写入指定目录；默认输出可能覆盖已有同名证据，不能把默认路径当作自动归档。

```bash
REVIEW_OUTPUT=/workspace/work/website-review-YYYYMMDD
python3 scripts/qa/verify_ui_consistency.py --url http://127.0.0.1:5180/website/ --output "$REVIEW_OUTPUT/ui"
python3 scripts/qa/verify_cream_scenic_ui.py --url http://127.0.0.1:5180/website/ --output "$REVIEW_OUTPUT/cream"
python3 scripts/qa/verify_profile_modules.py --url http://127.0.0.1:5180/website/ --output "$REVIEW_OUTPUT/profile"
python3 scripts/qa/verify_final_scene.py --url http://127.0.0.1:5180/website/ --output "$REVIEW_OUTPUT/scene"
python3 scripts/qa/verify_audit_hardening.py --url http://127.0.0.1:5180/website/ --output "$REVIEW_OUTPUT/hardening"
```

根路径构建时将URL改为`http://127.0.0.1:5180/`。个人模块检查还使用独立的`5181/website/`合成夹具；测试账号不会进入正式配置。浏览器工具需要Playwright、Chromium；像素检查还需要Pillow／NumPy，导出或影片编码另需FFmpeg。以各脚本的导入和`--help`为准；普通构建和CI资源核对不需要浏览器。

`qa/verify_audit_hardening.py`只允许本地preview，分别记录正常CSP与故意注入的阻挡探针，并测试可选API故障、静态回退及历史入口。`qa/measure_site_resources.py --url <本地preview> --output <新JSON路径>`记录真实请求与资源体积；与场景`--measure`一样，应独占浏览器测量，不把本地时间换成访客网络或设备保证。

`qa/verify_audit_20261113.py`补充合成IME、重复绘制故障、CRLF策略及无JS检查；`qa/verify_font_subset.py`检查实际默认请求、未包含字符fallback和Canvas对照，两个host分别指定URL和输出。资源工具支持`--width/--height/--dpr`合成视口，需区分同条件前后对照与单独视口观察。新结果存入独立任务目录，旧报告不覆盖。

当前验证范围：

| 工具 | 核对内容 |
| --- | --- |
| `qa/verify_ui_consistency.py` | 统一边框、键盘搜索、真实作品详情、静态HTML与移动布局 |
| `qa/verify_cream_scenic_ui.py` | 当前主题、字体／配图、导航、响应式侧栏和无JS |
| `qa/verify_profile_modules.py` | 社交／兴趣／游戏配置、可选资料与独立夹具 |
| `qa/verify_final_scene.py` | 原来源像素、雪樱、无媒体入口、相位接手、尺寸、偏好及故障恢复 |

场景快捷命令`scene:qa`和模块快捷命令`profile:qa`仍可用；同样应传入独立`--output`。已有证据按[证据索引](../artifacts/README.md)区分轮次，不将旧检查数量写成本次结果。

## 当前场景作者工具

| 命令 | 用途 |
| --- | --- |
| `npm run source:verify` | 核对不可变原工程和既有来源清单 |
| `npm run scene:derive` | 离线估计过渡，保留16个原来源锚点 |
| `npm run scene:export` | 从当前来源导出96色、64帧图集、高清首帧、预览影片及生成描述 |
| `npm run scene:verify` | 核对当前场景衍生文件与来源契约 |
| `npm run scene:capture -- --output <新目录>` | 实际CSS圆形的受控时间截图／预览 |
| `npm run scene:measure -- --output <新目录>` | 所有其他浏览器工作结束后独立观察原生回调和来源换帧 |

当前场景指南是[poetic-pixel.md](../docs/guides/poetic-pixel.md)。最高尺寸可用capture工具的`--measure --dpr 4`单独观察。截图采样率、影片编码率、模拟更新率和实测物理显示FPS需区分；本轮没有实际测量就不填写新性能结论。

## 历史工具

工具保留原位，默认首页不因此加载对应runtime。旧界面检查的视觉断言只适用于当时主题，旧人物检查也不替代当前场景验证。

| 历史阶段 | 代表工具与说明 |
| --- | --- |
| 简约／木牌像素界面 | `verify_pixel_minimal_ui.py`、`verify_pixel_world_ui.py`；主题已被奶油色界面取代 |
| 前版圆形场景与逐帧转制 | `verify_poetic_scene.py`、`verify_faithful_scene.py`、`verify_scenic_scene.py`、`verify_calm_circle.py`及对应capture／export工具 |
| 旧物理近景与发束 | `verify_layered_portrait.py`、`verify_portrait_browser.py`、`verify_raster_cache.py`、`capture_portrait*.py`、`measure_portrait*.py`及旧portrait作者工具 |
| 原始阶段与voxel | 既有Node历史测试和原始来源验证继续保留；仅显式历史入口使用对应实现 |

具体历史契约见[文件索引](../docs/README.md)，不能把旧指南中的“目前”解释为新版本默认。

## 发布

正常流程是任务PR通过相关检查和审查后合并`main`，由既有GitHub Actions部署Pages，再核对部署提交。Sites沿用`.openai/hosting.json`的既有项目身份和`dist`目录，通过官方保存／部署流程处理。`npm run deploy`会强推手动gh-pages备用分支，仅在用户明确要求该备用方式时使用；不修改workflow或绕过检查。
