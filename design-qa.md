# v1.2.0 晶面/晶向绘制本地验收

## 2026-09-11 绘制取景再次收紧（最新）

- 用户追加要求“再稍微大一些”。仅收紧绘制相机中完整标签边界之外的附加像素留白，并将距离余量从 0.1 收至 0.05；轴长仍为 1.5a。保持固定取景、原朝向、绘制计算与所有已发布模块不变。
- 同一 Chrome / DPR=1 / 缩放 100% 的 FCC、BCC 实测：桌面 1600×900 中框线从 209×228px 增至 213×233px，约再大 2%；手机 390×844 中从 78×86px 增至 82×90px，约再大 5%。画布大小和布局不变。
- 本轮对照图左前右后：[桌面 FCC](docs/qa/crystal-drawing/size-padding/desktop-fcc-comparison.png)、[桌面 BCC](docs/qa/crystal-drawing/size-padding/desktop-bcc-comparison.png)、[手机 FCC](docs/qa/crystal-drawing/size-padding/mobile-fcc-comparison.png)、[手机 BCC](docs/qa/crystal-drawing/size-padding/mobile-bcc-comparison.png)。[调整前测量](docs/qa/crystal-drawing/size-padding/before/results.json)、[调整后测量](docs/qa/crystal-drawing/size-padding/after/results.json) 及同目录的空画板、晶面、负指数晶向完整截图保留。
- 按追加放大需求更新 `drawingSize.test.ts` 的四个尺寸验收目标：将上一轮已不适用的 12%～14% 区间上限替换为更严格的最终投影尺寸快照断言，原放大下限、轴长、晶胞大小及朝向断言仍保留。调整运行时代码前四个尺寸用例失败，调整后 **221/221 测试通过**；防裁切、标签连续性和窗口往返测试没有修改或放宽。
- `npx tsc --noEmit`、`npm run build -- --base=/crystal/`、`git diff --check` 通过。仍只有既有单包超过 500kB 的构建警告。
- [开发预览回归](docs/qa/crystal-drawing/size-padding-regression/results.json)、[生产构建预览回归](docs/qa/crystal-drawing/size-padding-regression-build/results.json)：绘制、清除、模式切换、负指数、旋转、暂停、刷新和 `/crystal/` 资源加载通过，控制台及资源失败均为 0；两种预览的窗口往返像素差均为 0。
- 实际 WebGL 再次覆盖八种原点、四种画布尺寸、每圈 72 个角度，完整轴标签均未越界。晶向标签最大单步位移约 0.144、0.113、1.339px，均低于未改变的 4px 门限。
- 复现本轮对照：设置 `QA_SIZE_REFINEMENT=1` 运行 `scripts/qa-drawing-size.mjs before/after`，before 在本次收紧留白前采集。回归脚本设置 `QA_RUN_NAME=size-padding-regression`；其余本地开发/生产预览参数与上一轮相同，不覆盖历史证据。
- 当前 `dist/index.html` SHA-256：`50aed85d719da4d45746403943f3aedb28e4758cdfb440bb5a4125d98408123d`。
- 当前 `dist/assets/index-CeclWqP8.js` SHA-256：`c57d310eb82a777bd691f997662259de0205f7ea892193f91a4282f985fe63bd`；CSS 哈希仍为 `e9dffb081ec3483cde19c8c37fae38b56a53c07d414a57edf17ea197c0169490`。
- 当前绘制渲染文件 SHA-256 为 `eb0e283bee473acb29eaafca4e406ae11757212ba6997553957e97c702f9e87b`。仅在内存反向替换三个取景余量表达式，即与上一轮源码哈希完全一致；其他运行时文件未变。基线仍为 `8e880b4f1713ef835b2ce44871b49720c1234302` 上的未提交 `feature/v1.2.0` 内容。
- 限制：极端原点/旋转位置的标签外框已较接近画布边缘，仍完整显示。继续明显放大将需要用户重新确认固定取景的取舍，不能直接放大相机而重新引入裁切。未提交、推送、合并、打 Tag 或部署。

以下为上一轮及更早的验收记录，最新尺寸、产物哈希以上述内容为准。

## 2026-09-11 绘制模型适度放大

- 来源：`feature/v1.2.0`，基线 `8e880b4f1713ef835b2ce44871b49720c1234302` 上的未提交开发内容，不是已发布版本。用户确认采用适度放大、固定取景的方案。
- 本轮运行时代码只有 `src/render/crystalDrawingScene.ts` 中轴长从 `1.8a` 改为 `1.5a`；固定取景算法据此自动收紧。晶胞几何、默认朝向、晶面晶向计算、颜色、文字尺寸、相机接口与已发布模块均未改变。
- 新增 `src/render/drawingSize.test.ts` 的 5 条断言，覆盖实际轴长、晶胞尺寸、四种画布下的投影放大比例及朝向。修改前 5 条均失败，修改后全部通过。原有 216 条测试及断言未修改或放宽，总计 **221/221 通过**。
- `npx tsc --noEmit`、`npm run build -- --base=/crystal/`、`git diff --check` 通过。保留既有单包超过 500kB 的构建警告。

### 同视口对照

Chrome，DPR=1，缩放 100%；同一空白绘制状态、默认相机、旋转暂停。以实际 WebGL 中晶胞框线的像素包围框比较，不改变截图比例。

| 视口 / 晶体 | 画布尺寸 | 调整前框线宽高 | 调整后框线宽高 | 增幅 |
| --- | --- | --- | --- | --- |
| 桌面 1600×900 / FCC、BCC | 850×702 | 185×203 | 209×228 | 宽 +12.97%，高 +12.32% |
| 手机 390×844 / FCC、BCC | 374×290 | 69×77 | 78×86 | 宽 +13.04%，高 +11.69% |

- 理论投影宽高增幅为约 12%～13%；手机整数像素包围框受取整与抗锯齿影响，高度实测约 11.7%。画布尺寸、面板位置和文字尺寸保持一致。
- 对照图均为左侧调整前、右侧调整后：[桌面 FCC](docs/qa/crystal-drawing/size-adjustment/desktop-fcc-comparison.png)、[桌面 BCC](docs/qa/crystal-drawing/size-adjustment/desktop-bcc-comparison.png)、[手机 FCC](docs/qa/crystal-drawing/size-adjustment/mobile-fcc-comparison.png)、[手机 BCC](docs/qa/crystal-drawing/size-adjustment/mobile-bcc-comparison.png)。
- [调整前测量](docs/qa/crystal-drawing/size-adjustment/before/results.json)、[调整后测量](docs/qa/crystal-drawing/size-adjustment/after/results.json)。两目录还保存两种晶体的空画板、(111) 晶面、负指数晶向完整页面截图。
- 截图采集脚本：`scripts/qa-drawing-size.mjs`，参数 `before` / `after`。本轮 before 在修改轴长前采集；after 要求先有同视口基线，并自动比较包围框和生成对照图。

### 回归与交付边界

- [开发预览回归](docs/qa/crystal-drawing/size-adjustment-regression/results.json)、[生产构建预览回归](docs/qa/crystal-drawing/size-adjustment-regression-build/results.json)：绘制、清除、模式切换、负指数、旋转、暂停、刷新及资源加载通过，控制台错误和资源失败均为 0。两个预览的拖动缩放后窗口往返像素差均为 0。
- 实际 WebGL 检查八种原点 × 四种画布 × 每圈 72 个角度，轴标签均完整入镜且画面非空；[110]、[100]、负指数晶向以 0.1° 步长旋转的最大标签位移分别约 0.144、0.111、1.331px，未放宽原有 4px 门限。
- 复现回归时设置 `QA_RUN_NAME=size-adjustment-regression` 运行 `scripts/qa-drawing-review-fixes.mjs`。生产构建预览另外设置 `QA_BASE_URL=http://127.0.0.1:4180/crystal/ QA_RENDER_HARNESS=0`。两脚本复用现有外部 Playwright/pngjs 环境，`NODE_PATH` 指向该环境，不新增项目依赖。
- `dist/index.html` SHA-256：`f458ad0077eb7c556b32dc2270721f4526ce80d1e02f50825930aca03c44ad43`。
- `dist/assets/index-BNjRw9Bt.js` SHA-256：`4b18c93a0c6ca82c2085423e32acdf179b1fb4e2bf566f852fb4574ecf562806`。
- `dist/assets/index-CVdaQsgv.css` SHA-256：`e9dffb081ec3483cde19c8c37fae38b56a53c07d414a57edf17ea197c0169490`，与调整前一致。
- 渲染文件调整前 SHA-256 为 `1b1eff19fd7dad744e6cd0b9ffaee4140f23a537253bad90b751eb73ca21c006`，调整后为 `a41b1ef67e66e685aec712f856fa11a751c673a23c9f1957cd53a9f75e9c8dda`；在内存中仅反向替换轴长即可复现原哈希。其他运行时文件及原有测试哈希均未变。
- 保留历史证据；QA 脚本仅增加可选输出目录名称，避免覆盖上一轮证据。原工作树治理文件、暂存区以及分支/Tag 引用保持不变。未暂存、提交、推送、合并、打 Tag 或部署。
- 固定取景仍为所有原点与整圈旋转预留空间，手机上不会铺满画布；用户主动缩放和平移仍可移出边界，不强制纠偏。上述检查范围内未发现新增问题。

以下专项修复及开发记录为历史证据；本轮最新效果、测试数量和产物哈希以上述内容为准。

## 2026-09-11 绘制专项修复

- 范围仅限 `feature/v1.2.0` 新增的晶面/晶向绘制，依据 PRD 2026.9.9.1。本轮不修改、不重新 Review 已发布教学模块。
- 固定取景改为覆盖八种原点位置的完整 Z 轴旋转包络，并按画布像素尺寸预留轴标签空间。保持 FCC/BCC 晶胞预设的默认朝向，绘制、清除和自动旋转不触发相机重新取景。
- 窗口变化按新旧基础取景距离比例适配，保留用户的方向、目标点和相对缩放；缩放限制同步适配，离开绘制模块恢复原限制。
- 晶向标签保留上一帧的偏移侧；近视线方向使用滞回保持，从退化投影恢复时限制偏移角的变化，避免标签换边或突然跳动。
- 手机端新增绘制表单原本与画布顶部重叠 25px；仅将 `.drawing-viewport` 下的手机画布起点从 235px 调到 268px，保留 8px 间隔，不修改其他模块布局。
- `npm test`：216/216 通过。新增 `src/render/drawingReview.test.ts` 的 14 条回归，原有 202 条测试及断言保持原样。新增回归在修复前复现轴线出界、标签换边，以及近视线方向退出时的跳动。
- `npx tsc --noEmit` 与 `npm run build -- --base=/crystal/` 通过；保留既有单包超过 500kB 的构建警告，不进行拆包或依赖变更。
- 实际 Chrome/WebGL 验收：八种原点、四种画布尺寸（374×290、364×550、840×700、1260×700），每种原点采样 72 个旋转角，轴标签均完整入镜且画布非空白。
- 实际字体的晶向标签以 0.1° 步长检查完整一圈，`[110]`、`[100]`、负指数晶向的最大单步位移分别约 0.143、0.097、1.429px，均低于 4px 门限。
- 桌面 1600×900 和手机 390×844 的绘制、清除、模式切换、负指数、自动旋转、暂停及刷新通过。开发预览和生产构建预览的窗口往返缩放像素差均为 0；沿用既有 QA 的 500 帧阻尼收敛等待，像素判定门限未放宽。
- 两种预览的控制台错误、资源失败均为 0；生产 JS/CSS/图标均从 `/crystal/` 加载。

### 专项证据与复现

- [开发预览检查结果](docs/qa/crystal-drawing/review-fixes/results.json)、[生产构建检查结果](docs/qa/crystal-drawing/review-fixes-build/results.json)。
- [桌面绘制](docs/qa/crystal-drawing/review-fixes/desktop-plane.png)、[FCC 负指数晶向](docs/qa/crystal-drawing/review-fixes/desktop-fcc-negative-direction.png)、[BCC 负指数晶向](docs/qa/crystal-drawing/review-fixes/desktop-bcc-negative-direction.png)。
- [手机绘制](docs/qa/crystal-drawing/review-fixes/mobile-plane-full.png)、[手机负指数晶向](docs/qa/crystal-drawing/review-fixes/mobile-negative-direction-full.png)。
- 窗口往返缩放对照：[前](docs/qa/crystal-drawing/review-fixes/resize-before.png)、[后](docs/qa/crystal-drawing/review-fixes/resize-after.png)。
- 浏览器脚本为 `scripts/qa-drawing-review-fixes.mjs`，仅检查新增绘制功能。使用现有外部 Playwright/pngjs 工具环境，不增加项目依赖。
- 开发预览运行 `npm run dev -- --port 5180 --strictPort --base=/crystal/`；生产构建预览运行 `npm run preview -- --port 4180 --strictPort --base=/crystal/`。预览服务同样必须指定 `/crystal/`，不能沿用根路径预览参数。
- 运行 `node scripts/qa-drawing-review-fixes.mjs` 验证开发预览；设置 `QA_BASE_URL=http://127.0.0.1:4180/crystal/ QA_RENDER_HARNESS=0` 后运行同一脚本验证生产构建。`NODE_PATH` 指向本机已有 QA 工具环境。

### 本轮构建与边界

- `dist/index.html` SHA-256：`36c308f0a558e459f34f3ca70290d40ee581afa9ac73152fa32b985c3c255142`。
- `dist/assets/index-JK49dAkC.js` SHA-256：`028df9ee11574e3d58c1cf3219d7d8038b06ad74703e635e7a1b3f7470eb98a7`。
- `dist/assets/index-CVdaQsgv.css` SHA-256：`e9dffb081ec3483cde19c8c37fae38b56a53c07d414a57edf17ea197c0169490`。
- 以本轮开工时的文件哈希核对，源码变化仅为绘制渲染器、绘制专属手机样式和 `CrystalCanvas.tsx` 中绘制入口的相机适配及清理；另新增绘制回归测试。几何计算、状态计算、晶体数据、共享材质和其余组件均未改变。
- 共享 Canvas 与本轮修改前逐段比较，仅有绘制导入、绘制 resize 分支、绘制清理分支及绘制默认相机分支的变更。
- 原工作树两份治理文档及暂存区 SHA-256 未变；所有分支、Tag 引用未移动。没有暂存、提交、推送、合并、Tag 或部署操作。
- 固定取景会为整圈旋转预留空间，特别在手机端画板较小，这是用户已确认的取舍。用户主动放大或平移后可以移出边界，不强制纠偏；主动重置可恢复完整取景。未扩展 HCP 四指数绘制。

以下为本轮专项修复前的历史开发验收记录，其截图、构建哈希和旧结论不替代上述最新证据。

## 来源与状态

- 项目：晶体结构；日期：2026-09-09。
- 分支：`feature/v1.2.0`；基线：`8e880b4f1713ef835b2ce44871b49720c1234302`，创建前已核验与远端 `dev` 一致。
- 本记录对应此附属工作树的未提交开发内容，不是已发布版本或已创建的新 Tag。
- 需求来源：当前 PRD 的 2026.9.9.1 增量章节，以及用户确认的 FCC/BCC 范围、画布右上控件、右栏实时信息和默认暂停旋转。
- 开发预览：`http://127.0.0.1:5180/crystal/`；构建预览检查：`http://127.0.0.1:4180/crystal/`。均为本机，不涉及服务器。

## 结果

- `npm test`：202/202 通过，包括原有 160 条测试；模块顺序断言按新增需求更新，未删除原有晶体学断言。菜单回归确认 FCC/BCC 保留绘制入口、HCP 仅隐藏绘制入口；新增相机朝向一致性和旋转后晶向文字避让测试。
- `npm run build -- --base=/crystal/`：类型检查、生产构建通过；JS/CSS/图标路径均以 `/crystal/` 开头，浏览器请求成功，刷新正常。
- 几何：覆盖 342 组非零的小整数有符号组合，检验晶面顶点满足平面方程、方向比例不变、图形不越出单晶胞。
- 生命周期：原子不进入绘制画板；重复绘制只更新覆盖层；旧几何和材质释放，框线对象和根旋转保留。原点脉冲 450ms 后结束。
- 浏览器：绘制、清除、Enter 提交、全零输入拒绝、模式切换、负指数、快速连续绘制、重置视角及自动旋转状态恢复通过。
- 拖动阻尼收敛后，绘制再清除的原始 WebGL 图像前后像素差为 0；输入错误提示不改变上一幅有效图像。
- 既有功能冒烟：3 种金属的 21 个模块视图、当前基线实际菜单中 9 种离子的 36 个模块视图均非空白；离子位置图例逐种点击无异常。本次不增删离子结构。
- 390px 移动端：菜单和绘制面板可折叠、输入可操作、无横向溢出；HCP 绘制入口隐藏，切到 HCP 自动返回晶胞模型。
- 控制台错误和资源失败均为 0。无服务器部署或正式发布操作。
- 视觉对齐：绘制默认朝向直接复用对应晶胞模型预设，框线颜色和透明度不变；重新求解取景边界，减少过量留白。桌面画布顶部预留从 150px 改为标题栏高度 68px，手机仍保留表单空间。所有平移原点的 1.8a 正向轴仍能完整入镜，不改变绘制时的相机或根旋转。
- 晶向标注从箭头上方的固定世界坐标，改为屏幕投影垂直方向避让；标签总体缩小，旋转时继续避开箭身。

## 视觉证据

Chrome，DPR=1，缩放 100%；截图无需跨 DPR 缩放。PRD 没有像素级目标图，本次沿用已有 Header、中央标题、面板与材质规范。

- [原有晶胞模块视觉参考](docs/qa/crystal-drawing/design-qa-drawing-reference.png)：1600×1000，同一工作树的既有模块。
- [FCC (111)](docs/qa/crystal-drawing/design-qa-drawing-implementation.png)、[负指数晶面](docs/qa/crystal-drawing/design-qa-drawing-negative-plane.png)、[负指数晶向](docs/qa/crystal-drawing/design-qa-drawing-direction.png)。
- [手机完整页面](docs/qa/crystal-drawing/design-qa-drawing-mobile-full.png)：390×844 视口，完整纵向页面。
- [1600×900 构建视图](docs/qa/crystal-drawing/design-qa-drawing-build-1600.png)、[1920×1080 构建视图](docs/qa/crystal-drawing/design-qa-drawing-build-1920.png)。
- 视角连续性对照：[前](docs/qa/crystal-drawing/continuity-before.png)、[后](docs/qa/crystal-drawing/continuity-after.png)，同尺寸 WebGL 原始像素。
- [交互与像素检查结果](docs/qa/crystal-drawing/results.json)、[构建及计算样式](docs/qa/crystal-drawing/build-results.json)。
- HCP 菜单调整后单独复验：[桌面](docs/qa/crystal-drawing/design-qa-hcp-menu-desktop.png)、[手机](docs/qa/crystal-drawing/design-qa-hcp-menu-mobile.png)。入口不生成 DOM；保留其余 7 个模块，从绘制切换后回到晶胞模型，HCP 画布有 91,465 个蓝色模型像素，控制台无错误。上述全模块截图为菜单调整前的完整回归证据。
- 默认视角对比（1600×900）：[晶胞模型参考](docs/qa/crystal-drawing/design-qa-framing-cell-reference.png)、[调整前绘制](docs/qa/crystal-drawing/design-qa-framing-before.png)、[调整后绘制](docs/qa/crystal-drawing/design-qa-framing-implementation.png)。视角调整后已重新运行完整浏览器回归，`results.json` 与绘制截图对应当前实现；构建视图附件为本次相机调整前的历史检查。

中央标题栏沿用 68px 高、左右 26px 内边距、13px 图文间距；标题 18px/800。Logo 布局 34px，变换后约 49.3px。新控件桌面宽 264px，输入框高 36px、文字 16px。

## 构建校验

- `dist/index.html` SHA-256：`cd7f5071ec2ff9d6a7246d73bea3d9b8d8b01a5e3f8bd08567f7a080301431e1`
- `dist/assets/index-D23bKAOs.js`：`f6b2a65ea430d6b333413c7a23b9f49f81d53c8ae92a038fad61bfa75b11bce3`
- `dist/assets/index-CEXZ8czv.css`：`b5fc4e1db306a3f12aa3c3406ca16a02303dd85fef7966392cf06d3ecd64887e`

## 已知限制与复验

- 构建保留既有单包超过 500kB 的告警，当前 JS 约 795kB；本轮不进行无关拆包或依赖升级。
- 当前只有立方晶系三指数绘制；六方四指数不在本次范围。极大的指数可能触发浮点精度保护提示。
- 浏览器脚本位于 `scripts/qa-crystal-drawing.mjs` 和 `scripts/qa-drawing-build.mjs`；使用外部 QA 工具环境中的 Playwright、pngjs 及系统 Chrome，不增加生产依赖。通过 `NODE_PATH` 指向测试工具所在环境运行，脚本只访问本地地址。
- 原 `dev` 工作树的分支、暂存区及两份未提交规范 SHA-256 与开工前一致；`dev/release/main` 未移动。新工作树只应用已移交规范并保留为未提交修改。
- 本地检查未发现未关闭的 P0/P1/P2；待用户本地验收后再单独授权提交、推送和集成。
