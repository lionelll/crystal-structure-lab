# 晶面与晶向绘制依据

本功能对应 PRD 2026.9.9.1，范围限于 FCC/BCC 的立方晶胞几何练习。不显示原子，不将 FCC/BCC 的布拉菲点阵改称简单立方点阵；HCP 四指数绘制未纳入本次范围。

## 来源

- [IUCr: Miller indices](https://dictionary.iucr.org/Miller_indices)：晶面指数与晶轴截距的倒数关系。
- [Cornell: Miller Indices](https://www.classe.cornell.edu/~dms79/xrd/xtallography/Miller%20Indices.htm)：零指数对应平行轴，负指数使用上划线。
- 项目当前版本 PRD 的“负指数自动平移”是本教学画板的显示约定，不是晶胞结构发生变化。

## 计算约定

- 晶胞分数坐标为 `[0,1]^3`，边长 `a`。原点 `o_i` 在对应指数小于零时为 1，否则为 0；坐标轴正方向保持不变。
- 对用户输入的 `(hkl)`，显示平面 `h(x-o_x)+k(y-o_y)+l(z-o_z)=1` 与单晶胞的交集。遍历十二条棱求交，去重并按法向排序后做扇形三角化。
- 截距为 `a/h,a/k,a/l`；零分量为无穷远。保留原始输入的截距，不将 `(220)` 自动变成 `(110)`，也不宣称非互素输入是最简面取向指标。
- 晶向 `[uvw]` 起点为 `o`，终点为 `o+[u,v,w]/max(|u|,|v|,|w|)`；缩放不改变方向。右栏终点相对新原点显示，原点位置以初始晶胞坐标表示。
- 输入必须为可安全表示的整数且不可全零。超出浮点几何可分辨精度的退化结果报错，保留上一次有效绘图。
- 材质复用原密排面与密排方向的工厂；绘制模块移除场景雾效，避免长坐标轴所需的拉远视野把图形雾化。

对应自动化测试：`src/core/crystalDrawing.test.ts`、`src/core/drawingState.test.ts`、`src/render/crystalDrawingScene.test.ts`。
