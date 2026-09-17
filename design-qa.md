# v1.2.0 晶面/晶向绘制本地验收

## 2026-09-17 六方教学与实际截面一致性修复

- 基线仍为 `97bd34e3bb919b456a59b6a9103e6e4d791decce`，保留此前未提交内容。用户授权修正自查问题后，六方文案不再照搬立方逐轴平移规则：晶面以底面中心为原点；晶向基面负分量反向合成，w 为负时从顶面中心出发。立方文案、相机与已发布模块不变。
- 区分基准晶面截距 `1/index` 与实际展示层截距 `m/index`。当已绘制六方晶面的层级不是 1 时，相对截距下方显示动态说明；说明跟随 applied 数据，而非尚未绘制的输入草稿。清除、晶系与模式切换后不残留。
- 新增测试发现 `(1,0,-1,-1)` 等合法指数的 +1 层只接触棱，旧判断误认为可形成晶面。仅加固六方层级选择：内部截面或非零面积支撑面才有效，否则尝试 -1 层。顶面 basal 与正常 +1 层保持不变。
- 新增 15 项一致性回归：负 c 整数/分数截距、负 w 原点、动态说明状态、退化棱；遍历 h/k/l 在 -3 到 3 的 342 组非零指数，验证截面面积非零且每个顶点满足实际层级方程。原有测试保留，文案精确断言同步到本轮纠错文本。323/323 测试、类型检查、`/crystal/` 构建与 `git diff --check` 通过。
- 本地 IAB 桌面及 390×844 手机验证 `(000-1)`、`(000-2)`、`(10-1-1)`、`[10-1-1]`，确认模型非空、截距与说明匹配、手机无横向溢出。说明置于截距下方，未挤压轴名；控制台错误为 0。证据：[负 c 桌面](docs/qa/crystal-drawing/hex-teaching-consistency/negative-basal-desktop.jpg)、[混合负指数桌面](docs/qa/crystal-drawing/hex-teaching-consistency/mixed-negative-desktop.jpg)、[负 c 手机](docs/qa/crystal-drawing/hex-teaching-consistency/negative-basal-mobile.jpg)、[负 w 桌面](docs/qa/crystal-drawing/hex-teaching-consistency/negative-direction-desktop.jpg)、[手机教学说明](docs/qa/crystal-drawing/hex-teaching-consistency/negative-direction-mobile-notes.jpg)。
- 晶面指数及平行面概念参考 [Cambridge DoITPoMS: Miller indices](https://www.doitpoms.ac.uk/tlplib/miller_indices/printall.php)；固定底面原点与优先 +1、候补 -1 层是本绘制器的展示约定，不是一般晶体学强制规则。
- `dist/index.html` SHA-256：`60e0e228bdac0c4082338c056bcfd88346a84eec7225d9dbabdc4b5798b2fa24`。已知构建提示仍为单 JS 包超过 500 kB。本轮未提交、推送、合并、打 Tag 或部署。

## 2026-09-17 补齐其余三组教学文案

- 基线 `97bd34e3bb919b456a59b6a9103e6e4d791decce`，继续在 `feature/v1.2.0` 保留本日未提交修改。文案来源为用户本次提供的立方晶面、六方晶向、六方晶面三段内容；原样配置，只有立方晶面末尾重复句号 `。。` 归一为 `。`。上一项立方晶向文案及截距格式保持不变，未调整绘制几何、状态、相机或已发布模块。
- 三组均按“作图技巧 / 作图步骤 / 注意事项”独立分段。晶面使用独立编号列表；六方晶向的“方法一 / 方法二”使用二级小标题与独立段落，注意事项为单段。新增样式仅作用于 `.drawing-teaching-method`，维持原有 15px 字号和 1.9 行高。
- 新增 6 组绘制前后全文回归，并按新文案更新四模式的标题、段落、列表精确断言；308/308 测试通过，`npm run build -- --base=/crystal/`（含类型检查）通过。保留既有单 JS 包超过 500 kB 提示。
- 本地 IAB `http://127.0.0.1:5181/crystal/`，1600×900 桌面（DPR=2）与 390×844 手机（DPR=1），100% 缩放。三模式切换、绘制、刷新通过；两端无横向溢出，长文案及公式正常换行并可滚动阅读，控制台错误为 0。
- 证据：[立方晶面桌面](docs/qa/crystal-drawing/drawing-guidance/cubic-plane-desktop.jpg)、[六方晶面桌面](docs/qa/crystal-drawing/drawing-guidance/hex-plane-desktop.jpg)、[六方晶向桌面](docs/qa/crystal-drawing/drawing-guidance/hex-direction-desktop.jpg)、[立方晶面手机](docs/qa/crystal-drawing/drawing-guidance/cubic-plane-mobile.jpg)、[六方晶面手机](docs/qa/crystal-drawing/drawing-guidance/hex-plane-mobile.jpg)、[六方晶向手机](docs/qa/crystal-drawing/drawing-guidance/hex-direction-mobile.jpg)。
- `dist/index.html` SHA-256：`64512fa6f58df0481f75811c2612526b0ef1a157df84920bfaac3573887fc361`。本轮未提交、推送、合并、打 Tag 或部署。

## 2026-09-17 立方晶向教学文案

- 来源仍为 `feature/v1.2.0` 基线 `97bd34e3bb919b456a59b6a9103e6e4d791decce` 上的未提交修改，保留本日截距去后缀调整。用户本次提供一段文案，仅替换立方晶向教学解析；立方晶面、六方晶面与六方晶向原文保持不变，绘制计算和已发布模块未修改。
- 按原文显示“作图技巧：”“作图步骤：”“注意事项：”，技巧独立成段，步骤及注意事项分别使用两条有序列表，各自从 1 编号；沿用原字号、行高、标题和列表间距，不修改 CSS。
- 新增绘制前后完整文案回归，更新旧文案对应的精确期望；其他三模式仍断言原标题、段落及列表结构，不出现新增注意事项。`npm test` 302/302 通过，`npm run build -- --base=/crystal/`（含类型检查）通过；仍有既有单 JS 包超过 500 kB 提示。
- IAB 本地 `http://127.0.0.1:5181/crystal/`，桌面 1600×900（DPR=2）、手机 390×844（DPR=1），缩放 100%。两种视口无横向溢出；桌面右栏沿用滚动容器，可阅读最后一条注意事项；手机段落、编号自然换行，无遮挡。绘制、模式切换与清除后教学文案匹配，控制台错误为 0。
- 证据：[桌面](docs/qa/crystal-drawing/cubic-direction-guidance/desktop.jpg)、[桌面注意事项](docs/qa/crystal-drawing/cubic-direction-guidance/desktop-notes.jpg)、[手机](docs/qa/crystal-drawing/cubic-direction-guidance/mobile.jpg)。`dist/index.html` SHA-256：`49ace083a6eaa23de1095a19e1e0b7d58c409db707bca455d2aa05fb8cc25bc4`。未提交、推送、合并、打 Tag 或部署。

## 2026-09-17 相对截距移除单位后缀

- 来源：`feature/v1.2.0`，基线 `97bd34e3bb919b456a59b6a9103e6e4d791decce` 上的未提交修改。仅调整绘制专属 `interceptText`：有限截距直接显示数字或分数，不再追加 `a`；保留 `X/Y/Z`、`a₁/a₂/a₃/c` 轴名及 `∞（平行）`。几何、状态、相机、教学解析和已发布模块不变。
- 新增 5 组信息栏精确输出回归，覆盖两晶系、正负整数、分数、平行轴及六方负层级；原有几何断言保留，仅按新需求更新单位后缀期望。`npm test` 300/300 通过，`npm run build -- --base=/crystal/`（含类型检查）通过；既有单 JS 包超过 500 kB 提示仍在。
- 本地 IAB `http://127.0.0.1:5181/crystal/`，桌面 1600×900、手机 390×844，DPR=1、缩放 100%。立方 `(1,-2,0)` 显示 `X：1 / Y：-1/2 / Z：∞（平行）`；六方 `(1,0,-1,0)` 显示 `a₁：1 / a₂：∞（平行） / a₃：-1 / c：∞（平行）`。切换、绘制与刷新通过，手机无横向溢出，控制台错误为 0。
- 证据：[立方桌面](docs/qa/crystal-drawing/intercept-values/cubic-desktop.jpg)、[六方桌面](docs/qa/crystal-drawing/intercept-values/hexagonal-desktop.jpg)、[立方手机](docs/qa/crystal-drawing/intercept-values/cubic-mobile.jpg)、[六方手机](docs/qa/crystal-drawing/intercept-values/hexagonal-mobile.jpg)。本项仅变更文字，无几何或布局调整。
- `dist/index.html` SHA-256：`b9e564f29d4e0be2563f2ed3059b85c36ba9c243121643f8450b38bd7ca1c5b9`。未提交、推送、合并、打 Tag 或部署。

## 2026-09-16 教学解析分行

- 基线 `6d58e72a7e8d66442d59f6d1f19bec5834ace8fe`，保留 `feature/v1.2.0` 此前未提交修改。本项仅修改 `DrawingInfo` 文案结构、绘制专属样式及测试；几何、状态、渲染与已发布模块均未调整。
- 按用户提供的四组文案，将“核心口诀/核心公式”“绘制步骤”改为独立标题，口诀、三四轴转换和公式采用独立段落；立方 3 条、六方 2 条步骤采用有序列表，编号各占一行，续行对齐正文。样式仅限绘制教学区域，保留 15px 字号与 1.9 行高。
- 新增四组结构回归，`npm test` 295/295 通过；`npm run build -- --base=/crystal/`（含类型检查）通过。仅保留既有单 JS 包超过 500 kB 的构建提示。
- IAB 本地 `http://127.0.0.1:5181/crystal/`，1600×900 与 390×844，DPR=1、缩放 100%。四种模式在两种视口均无段落/列表重叠、无横向溢出；切换文案正确，控制台错误为 0。证据：[立方晶面桌面](docs/qa/crystal-drawing/teaching-lines/cubic-plane-desktop.jpg)、[六方晶向桌面](docs/qa/crystal-drawing/teaching-lines/hex-direction-desktop.jpg)、[立方晶面手机](docs/qa/crystal-drawing/teaching-lines/cubic-plane-mobile.jpg)、[六方晶面手机](docs/qa/crystal-drawing/teaching-lines/hex-plane-mobile.jpg)、[八组布局检查](docs/qa/crystal-drawing/teaching-lines/layout.json)；同目录保留其余模式截图。
- `dist/index.html` SHA-256：`83783b9b28d74f58e677ac6c78ff41fb67963c85f4a0c034f87be09e892fb9ab`。未提交、推送、合并、打 Tag 或部署。

## 2026-09-16 当前信息字段精简

- 本项仅修改绘制专属 `DrawingInfo` 和对应测试，立方/六方的晶面与晶向均不再显示“原点位置”“方向比例”。保留绘制类型、绘图晶胞、当前指数、相对截距或相对终点及教学解析；原点平移、方向计算和模型渲染不变。
- 新增 8 个回归用例，覆盖两种晶系、两种模式和绘制前后状态；`npm test` 291/291 通过，`npm run build -- --base=/crystal/`（含类型检查）通过。既有单 JS 包超过 500 kB 提示仍在。
- 本地 IAB，100% 缩放、DPR=1，桌面 1600×900 与手机 390×844 检查字段移除及保留项，控制台错误为 0。证据：[六方晶向桌面](docs/qa/crystal-drawing/info-fields/hex-direction-desktop.jpg)、[立方晶面手机](docs/qa/crystal-drawing/info-fields/cubic-plane-mobile.jpg)。
- `dist/index.html` SHA-256：`ddc927c99bd4508c07676beedb18e0a61ea769b153a39d76be5f3ffaa426f4c4`。保留此前未提交修改；本轮未提交、推送、合并、打 Tag 或部署。

## 2026-09-16 六方三轴与四轴输入

- 基线 `6d58e72a7e8d66442d59f6d1f19bec5834ace8fe`，`feature/v1.2.0` 未提交修改；保留前两项尺寸、字号与默认机位调整，本项只新增绘制输入、转换函数、状态同步及测试，不改晶面/晶向几何或已发布模块。
- 六方晶面、晶向均同时提供四轴和三轴两行输入。编辑行保留用户原文，另一行同步转换；i/t 延续只读联动。仅“绘制”或 Enter 应用结果，未完成输入、非法字符和全零保留上一幅有效图形。模式切换按最后编辑行重新换算，离开六方后重置为原立方三输入框。
- 晶面 `(h,k,l) -> (h,k,-h-k,l)`，逆变换保留 h/k/l；不约去倍数，以保持既有截距语义。晶向 `[U,V,W] -> [2U-V,2V-U,-U-V,3W]` 后约为最简整数比；逆向 `[u-t,v-t,w]` 同样化简且保留方向符号。BigInt 中间运算避免整型溢出导致错误比例，结果仍执行安全整数范围校验。
- 换算来源：[剑桥大学 Materials Algorithms Project](https://www.phase-trans.msm.cam.ac.uk/map/crystal/subs/notat1-b.html)（实空间与倒空间逆变换）、[Yusuke Seto 晶体学讲义](https://yseto.net/en/crystallography-e/suppl-e/suppl-10)（三轴/四轴正逆公式）。测试覆盖 342 组小整数晶向的几何同向性及往返换算。
- `npm test` 283/283 通过；`npm run build -- --base=/crystal/` 包含类型检查并通过。保留原有测试，只扩展初始状态断言以包含新增字段。既有单 JS 包超过 500 kB 的构建提示仍在，本轮不拆包。
- IAB，100% 缩放、DPR=1，桌面 1600×900、手机 390×844，地址 `http://127.0.0.1:5181/crystal/`。实测三轴晶向 `[101]`、四轴反向输入、负指数晶面、基面 `(001)`、模式/晶系切换、清除、非法输入、Enter 提交与刷新。控制台错误为 0，首页及本次相关 JS/TS/CSS 请求均为 200。
- 手机六方参数区采用文档流、保持原右对齐位置和 254px 宽度，画布固定 290px 高，展开、折叠及错误提示均留 10px 间隔，无覆盖和横向溢出；桌面布局与立方布局不变。输入高 36px、字 16px；三轴输入框宽约 54.66px。画布像素检查检出晶向红色 381px、晶面蓝色 1,896px，确认非空白并正确显示。
- 证据：[用户参考](docs/qa/crystal-drawing/three-axis-input/design-qa-three-axis-request.png)、[桌面晶面](docs/qa/crystal-drawing/three-axis-input/hex-plane-desktop.jpg)、[桌面晶向](docs/qa/crystal-drawing/three-axis-input/hex-direction-desktop.jpg)、[手机晶向](docs/qa/crystal-drawing/three-axis-input/hex-direction-mobile.jpg)、[手机晶面](docs/qa/crystal-drawing/three-axis-input/hex-plane-mobile.jpg)、[手机错误提示](docs/qa/crystal-drawing/three-axis-input/hex-error-mobile.jpg)、[布局数据](docs/qa/crystal-drawing/three-axis-input/layout.json)。
- 构建 SHA-256：`dist/index.html` = `120c165d8bf9dac635ebdb82a692e30730740c60ca965ffb7489b46aef2097a4`；`index-DclMMdwT.js` = `28b940f4935f6152c4b8dac9168a7189a89dc56738b69a4e379ab2780f2dffb4`；`index-CmiISN4e.css` = `fe9b490ac7e7b87b00e1e38a12af09645c97341de271f0a420ac7db997e0bc33`。
- 本轮未提交、推送、合并、打 Tag 或部署；线上版本未变化。

## 2026-09-16 默认视角与六方轴长

- 仅调整绘制模块的相机接入、渲染和测试；既有晶胞模型预设及晶面/晶向几何计算未修改。保留上一轮 1.4 倍相机倍率和固定屏幕尺寸的指数标签。
- 按用户两张参考图设置绘制专属默认机位：立方方位角 18°、六方方位角 39°，仰角均为 18°。立方 X 朝左下、Y 朝右、Z 朝上；六方 a1 朝左下、a2 朝右、a3 朝左上、c 朝上。进入、切换晶系及主动重置采用该预设，窗口变化仍保留用户视角。
- c 轴长度保持不变，a1/a2/a3 缩短为 c/1.633；轴标签随端点更新。保留原取景距离下限，避免短轴触发模型反向放大，并补充低仰角下 c 标签的取景边界。
- `npm test`：255/255 通过；`npm run build -- --base=/crystal/`（含 TypeScript 检查）通过。新增朝向投影、1.633 长度比及四种视口下六方 72 个旋转角度的完整标签边界断言。未删除原有几何或连续性测试。
- 本地 IAB、1600×900 与 390×844 验证晶系切换、晶向绘制、清除、重置和旋转；无横向页面溢出，控制台错误为 0。桌面画布检出 1,080 个红色箭头像素，旋转前后 12,851 个显著变化像素，确认模型非空且动画运行。
- 截图：[立方桌面](docs/qa/crystal-drawing/default-view/cubic-desktop.jpg)、[六方桌面](docs/qa/crystal-drawing/default-view/hexagonal-desktop.jpg)、[立方手机](docs/qa/crystal-drawing/default-view/cubic-mobile.jpg)、[六方手机](docs/qa/crystal-drawing/default-view/hexagonal-mobile-folded.jpg)。手机沿用原可折叠悬浮参数面板，展开时仍可能遮住局部轴线；折叠后核验完整模型，本轮不调整面板布局。
- 预览：`http://127.0.0.1:5181/crystal/`。未提交、推送、合并、打 Tag 或部署；保留已有 JS 单包超过 500 kB 的构建提示。

## 2026-09-16 模型缩小与指数标签恢复

- 基线为 `6d58e72a7e8d66442d59f6d1f19bec5834ace8fe`；本次是 `feature/v1.2.0` 上的未提交调整，仅修改绘制专属渲染与测试。
- 立方、六方默认相机倍率由 2 改为 1.4，同视角下晶胞投影宽高均为基线的 70%。保持几何、默认朝向和输入计算不变。
- 指数标签使用包含相机 zoom 的有效视场换算，恢复放大前的 36 CSS px 精灵画布高度（包含纹理留白，不是字形高度）；晶向避让距离同步按有效视场计算。坐标轴文字继续随模型倍率变化，负指数上划线绘制未修改。
- `drawingSize.test.ts` 按新需求将旧 200% 目标更新为精确 70% 比例，覆盖两种晶系及四种画布尺寸；补充两种晶系、两种绘制模式在缩放与相机远近变化下的固定标签尺寸。248 项测试及 `/crystal/` 生产构建通过，构建包含 TypeScript 检查；原有旋转连续性与窗口往返测试保留。
- 本地预览 `http://127.0.0.1:5181/crystal/`，IAB 浏览器、DPR=1、100% 页面缩放；检查 1600×900 桌面和 390×844 手机。立方/六方晶向、立方负指数晶面、六方晶面切换成功；页面无横向溢出，浏览器控制台错误为 0。
- [桌面对照（左为基线，右为调整后）](docs/qa/crystal-drawing/size-reduction/desktop-comparison.png)、[手机立方晶向](docs/qa/crystal-drawing/size-reduction/mobile-cubic-direction.png)、[手机六方晶向](docs/qa/crystal-drawing/size-reduction/mobile-hex-direction.png)、[检查数据](docs/qa/crystal-drawing/size-reduction/measurements.json)。IAB 全页基线截图以半尺寸拼接，已将有效页面区域归一到 CSS 像素；对照中的基线细线清晰度受原始采样影响，精确缩放比例以投影测试为准。
- 四个桌面/手机晶向截图的画布区域均检出红色箭头像素；自动旋转前后模型区域有 12,449 个显著变化像素，确认画布非空白且动画仍运行。
- 本轮未提交、推送、合并或部署；测试站仍为上述基线版本。保留已有 JS 单包超过 500 kB 的构建提示。

以下为历史验收记录。

## 2026-09-14 绘制信息与负指数标注修复（最新）

- 仅修改 `feature/v1.2.0` 的晶面/晶向绘制：当前信息移除“绘图晶胞”，并删除该模块整块“教学解析”；其他模块的右栏内容不变。
- 负指数不再依赖字体对 Unicode 组合上划线的定位。右栏把三个指数拆为独立元素，仅对负数元素绘制上划线；3D 标签按实际字体宽度分段测量，并仅在负数 run 的水平范围内单独画线。
- `[1,-2,1]` / `(1,-2,1)` 的回归锁定为只有中间 `2` 带上划线；多位指数的分隔空白不纳入上划线。新增右栏结构、指数 token 和 Canvas 布局测试。
- `npm test`：225/225 通过；`npm run build -- --base=/crystal/` 通过。保留既有单 JS 包超过 500kB 的构建提示。
- Chrome、DPR=1、缩放 100% 下完成桌面 1600×900 和手机 390×844 验收：绘图晶胞与教学解析均不生成；上划线只覆盖 `2`；手机无横向溢出；控制台错误和资源失败均为 0。
- 验收结果：[results.json](docs/qa/crystal-drawing/negative-index-fix/results.json)；截图：[桌面完整页](docs/qa/crystal-drawing/negative-index-fix/drawing-negative-index-desktop-full.png)、[当前信息](docs/qa/crystal-drawing/negative-index-fix/drawing-negative-index-current-info.png)、[3D 标签](docs/qa/crystal-drawing/negative-index-fix/drawing-negative-index-stage.png)、[手机完整页](docs/qa/crystal-drawing/negative-index-fix/drawing-negative-index-mobile-full.png)。
- 当前构建 SHA-256：`dist/index.html` 为 `6cd2746b784e793fec823513dc494d4b9c9e55e9a6634e997dd5c4b37bdf1092`，JS 为 `6e553799f0b21cae7038f2c7f9c2944da4c1ddbae647c6f0e3972d666b6a352e`，CSS 为 `a33cf803361f9988d3bbccce01c57c8764221cb7026afbb7d5f93674ee87c6ab`。
- 本轮未提交、未推送、未合并、未打 Tag、未部署；`dev/release/main` 与已发布模块未修改。

以下为前一轮及更早的验收记录；最新右栏与负指数显示以上述内容为准。

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

## 2026-09-18 绘制轴端可见性专项修复

仅针对 v1.2.0 绘制模块的坐标轴/标签裁切和参数面板遮挡，采用当前实际边界的最小取景补偿，不使用全原点统一缩小。原科学计算、轴长、字号与历史模块实现未改。

359项测试、类型检查和 `/crystal/` 构建通过；桌面和390px移动端三个复现用例、面板变化、手动观察、旋转、重置与模块切换已本地复验。取景存在必要的位移/缩放，手动观察后不强制纠正。详细范围、取舍及最终截图见[专项验收摘要](docs/qa/drawing-axis-visibility-2026-09-18/final-summary.md)。远程部署验收另行登记，不沿用历史发布结论。
