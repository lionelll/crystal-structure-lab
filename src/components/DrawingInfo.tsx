import { drawingIndexTokens, fractionText, interceptText, type DrawingIndices, type DrawingMode } from '../core/crystalDrawing';
import type { DrawingState } from '../core/drawingState';

export function DrawingIndex({ mode, indices }: { mode: DrawingMode; indices: DrawingIndices }) {
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
  const isHexagonal = state.crystalSystem === 'hexagonal';
  const notation = mode === 'plane'
    ? (isHexagonal ? '(hkil)' : '(hkl)')
    : (isHexagonal ? '[uvtw]' : '[uvw]');
  const teaching = isHexagonal
    ? mode === 'plane'
      ? {
          heading: '【核心公式】',
          lines: ['三轴 (hkl)→ 四轴 (hkil)，满足恒等式：i=-(h+k)'],
          steps: [
            '原点不在此面上，先求出在 a1,a2,c 三轴上的截距并倒数化简，得到三轴指数 (hkl)；',
            '直接根据 i=-(h+k) 补齐第三个基面指数，写成四轴指数 (hkil)。',
          ],
        }
      : {
          heading: '【核心公式】',
          lines: ['三轴 [UVW]→ 四轴 [uvtw]', 'u=(2U-V)/3,  v=(2V-U)/3,  t=-(u+v),  w=W'],
          steps: [
            '先按三轴系 (a1,a2,c) 标出矢量坐标并化简为三轴指数 [UVW]；',
            '代入转化公式计算四轴指数 [uvtw]，其中 t=-(u+v)。',
          ],
        }
    : mode === 'plane'
      ? {
          heading: '【核心口诀】',
          lines: ['定原点→建坐标系→求截距→取倒数→化整数比→加圆括号 (hkl)'],
          steps: [
            '建立右手坐标系，注意原点绝不能选在待画晶面上，以防止出现零截距；',
            '确定晶面在 x,y,z 轴的截距（平行截距为∞）；',
            '取各轴截距的倒数，化简为最小互质整数比 (hkl)。',
          ],
        }
      : {
          heading: '【核心口诀】',
          lines: ['定原点→建坐标系→求分量→化整数比→加方括号[uvw]'],
          steps: [
            '以晶胞顶点为原点建立右手坐标系；',
            '取矢量端点相对于原点的坐标分量（坐标差法）；',
            '化为最小互质整数比即为 [uvw]，负指数将原点沿该轴正向平移1个单位。',
          ],
        };
  return (
    <aside className="right-rail panel-stack drawing-info" aria-label="绘制信息">
      <section className="panel info-card">
        <div className="card-title">当前信息</div>
        <dl className="info-grid">
          <dt>绘制类型：</dt><dd>{mode === 'plane' ? `晶面 ${notation}` : `晶向 ${notation}`}</dd>
          <dt>绘图晶胞：</dt><dd>{isHexagonal ? '六方晶胞' : '立方晶胞'}</dd>
          <dt>当前指数：</dt><dd data-testid="drawing-index">{drawing ? <DrawingIndex mode={mode} indices={drawing.indices} /> : '未绘制'}</dd>
          {drawing?.mode === 'plane' && <><dt>相对截距：</dt><dd><span>{drawing.indices.map((value, i) => <span className="drawing-info-line" key={i}>{(isHexagonal ? ['a₁', 'a₂', 'a₃', 'c'] : ['X', 'Y', 'Z'])[i]}：{interceptText(value, drawing.planeLevel)}</span>)}</span></dd></>}
          {drawing?.mode === 'direction' && <>
            <dt>相对终点：</dt><dd>({drawing.indices.map((v) => fractionText(v, drawing.divisor)).join(', ')})</dd>
          </>}
        </dl>
      </section>
      <section className="panel teaching-card">
        <div className="card-title">教学解析</div>
        <div className="teaching-body drawing-teaching">
          <h3>{teaching.heading}</h3>
          {teaching.lines.map((line) => <p key={line}>{line}</p>)}
          <h3>【绘制步骤】</h3>
          <ol>{teaching.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      </section>
    </aside>
  );
}
