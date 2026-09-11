import { formatDrawingIndex, fractionText, interceptText } from '../core/crystalDrawing';
import type { DrawingState } from '../core/drawingState';

export function DrawingInfo({ state }: { state: DrawingState }) {
  const drawing = state.applied;
  const mode = drawing?.mode ?? state.mode;
  const origin = drawing?.origin ?? [0, 0, 0];
  const movedAxes = ['X', 'Y', 'Z'].filter((_, i) => origin[i] !== 0);
  return (
    <aside className="right-rail panel-stack drawing-info" aria-label="绘制信息">
      <section className="panel info-card">
        <div className="card-title">当前信息</div>
        <dl className="info-grid">
          <dt>绘制类型：</dt><dd>{mode === 'plane' ? '晶面 (hkl)' : '晶向 [uvw]'}</dd>
          <dt>绘图晶胞：</dt><dd>立方晶胞线框 · a = 1</dd>
          <dt>当前指数：</dt><dd data-testid="drawing-index">{drawing ? formatDrawingIndex(mode, drawing.indices) : '未绘制'}</dd>
          <dt>原点位置：</dt><dd>O = ({origin.join(', ')})</dd>
          {drawing?.mode === 'plane' && <><dt>相对截距：</dt><dd><span>{drawing.indices.map((value, i) => <span className="drawing-info-line" key={i}>{['X', 'Y', 'Z'][i]}：{interceptText(value)}</span>)}</span></dd></>}
          {drawing?.mode === 'direction' && <>
            <dt>方向比例：</dt><dd>{drawing.indices.join(' : ')}</dd>
            <dt>相对终点：</dt><dd>({drawing.indices.map((v) => fractionText(v, drawing.divisor)).join(', ')})</dd>
          </>}
        </dl>
      </section>
      <section className="panel teaching-card">
        <div className="card-title">教学解析</div>
        <p>采用立方晶胞作为几何画板，省略原子；不改变所选 FCC 或 BCC 的实际点阵类型。</p>
        <p>{mode === 'plane'
          ? '晶面 (hkl) 的相对截距为 a/h、a/k、a/l。指数为 0 时，晶面平行于对应坐标轴。保留输入指数对应的截距，不自动约分。'
          : '晶向 [uvw] 表示沿三个晶轴的位移比例。箭头按最大指数绝对值等比例缩放至单晶胞边界，长度不代表实际位移大小。'}</p>
        {drawing && <p>{movedAxes.length
          ? `由于 ${movedAxes.join('、')} 方向的指数为负，原点沿相应正轴各平移 a，坐标轴方向不变。截距和位移均相对新原点计算。`
          : '当前指数无负分量，原点保持在初始顶点，坐标轴方向不变。'}</p>}
      </section>
    </aside>
  );
}
