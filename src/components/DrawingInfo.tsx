import { drawingIndexTokens, fractionText, interceptText, type DrawingMode, type Point3 } from '../core/crystalDrawing';
import type { DrawingState } from '../core/drawingState';

export function DrawingIndex({ mode, indices }: { mode: DrawingMode; indices: Point3 }) {
  const tokens = drawingIndexTokens(indices);
  const separator = indices.some((value) => Math.abs(value) > 9) ? ' ' : '';
  const accessible = tokens.map((token) => `${token.negative ? '负' : ''}${token.text}`).join('、');
  return (
    <span className="drawing-index-value" aria-label={`${mode === 'plane' ? '晶面' : '晶向'}指数：${accessible}`}>
      <span aria-hidden="true">{mode === 'plane' ? '(' : '['}</span>
      {tokens.map((token, index) => (
        <span aria-hidden="true" key={index}>
          {index > 0 && separator}
          <span className={`drawing-index-token${token.negative ? ' is-negative' : ''}`}>{token.text}</span>
        </span>
      ))}
      <span aria-hidden="true">{mode === 'plane' ? ')' : ']'}</span>
    </span>
  );
}

export function DrawingInfo({ state }: { state: DrawingState }) {
  const drawing = state.applied;
  const mode = drawing?.mode ?? state.mode;
  const origin = drawing?.origin ?? [0, 0, 0];
  return (
    <aside className="right-rail panel-stack drawing-info" aria-label="绘制信息">
      <section className="panel info-card">
        <div className="card-title">当前信息</div>
        <dl className="info-grid">
          <dt>绘制类型：</dt><dd>{mode === 'plane' ? '晶面 (hkl)' : '晶向 [uvw]'}</dd>
          <dt>当前指数：</dt><dd data-testid="drawing-index">{drawing ? <DrawingIndex mode={mode} indices={drawing.indices} /> : '未绘制'}</dd>
          <dt>原点位置：</dt><dd>O = ({origin.join(', ')})</dd>
          {drawing?.mode === 'plane' && <><dt>相对截距：</dt><dd><span>{drawing.indices.map((value, i) => <span className="drawing-info-line" key={i}>{['X', 'Y', 'Z'][i]}：{interceptText(value)}</span>)}</span></dd></>}
          {drawing?.mode === 'direction' && <>
            <dt>方向比例：</dt><dd>{drawing.indices.join(' : ')}</dd>
            <dt>相对终点：</dt><dd>({drawing.indices.map((v) => fractionText(v, drawing.divisor)).join(', ')})</dd>
          </>}
        </dl>
      </section>
    </aside>
  );
}
