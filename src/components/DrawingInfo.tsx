import { drawingIndexTokens, fractionText, interceptText, type DrawingIndices, type DrawingMode } from '../core/crystalDrawing';
import type { DrawingState } from '../core/drawingState';

type DrawingTeaching = {
  heading: string;
  lines: string[];
  stepsHeading?: string;
  steps?: string[];
  methods?: { title: string; text: string }[];
  notes?: string[] | string;
};

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
  const teaching: DrawingTeaching = isHexagonal
    ? mode === 'plane'
      ? {
          heading: '作图技巧：',
          lines: ['选原点→四轴取截距→标点连面→标指数'],
          stepsHeading: '作图步骤：',
          steps: [
            '求截距：取指数倒数，分别求出基准晶面在a1,a2,a3,c四个轴上的截距 (1/h,1/k,1/i,1/l)。',
            '标点连线：在底面三轴及高轴c上标出截距点，连接并延伸得到晶胞内的截面（底面上的有限截距点共线）。',
          ],
          notes: [
            '数字 0：倒数为 ∞，表示晶面与该轴平行（沿该轴平移拉伸成面）。',
            '原点与负号：本图原点固定在底面中心，负截距位于对应轴的负方向，不按负指数逐轴平移原点。',
            '平行晶面：若基准晶面不能在晶胞内形成完整截面，则选取同组平行晶面；实际截距按层级 m 除以对应指数计算。',
            '恒等校验：必须满足 i=-(h+k)。',
          ],
        }
      : {
          heading: '作图技巧：',
          lines: ['选原点→矢量合成（或转三轴）→确定终点→连线标向'],
          stepsHeading: '作图步骤：',
          methods: [
            {
              title: '方法一（四轴直接合成法）：',
              text: '从原点出发，底面沿a1,a2,a3轴分别截取u,v,t分量，利用平行四边形法则合成为底面矢量，再沿c轴按w的正负方向叠加分量到达终点，连线画出箭头。',
            },
            {
              title: '方法二（转三轴简易法）：',
              text: '利用公式 U=2u+v, V=2v+u, W=w（或 U=u-t, V=v-t）转换为三轴指数 [UVW]，仅在a1,a2,c三轴系中定点连线。',
            },
          ],
          notes: '基面负分量沿对应轴反方向参与矢量合成，无需逐轴平移原点。本图 w≥0 时取底面中心，w<0 时取顶面中心；晶向保持不变，长度等比例缩放至晶胞边界。',
        }
    : mode === 'plane'
      ? {
          heading: '作图技巧：',
          lines: ['选原点→建坐标系→取截距→画晶面→标指数'],
          stepsHeading: '作图步骤：',
          steps: [
            '算截距定原点：先取晶面指数(hkl)的倒数作为各轴截距（1/h, 1/k, 1/l）。',
            '标截距连晶面：在各晶轴上标出截距点并连成多边形（截面）。',
          ],
          notes: [
            '数字0表平行：指数为0时，其倒数为无穷大，表示晶面与该坐标轴平行（连线时沿该轴方向平移拉伸成面）。',
            '负号平移：哪个轴带有负号，原点就向该轴正方向平移1个晶胞边长。',
          ],
        }
      : {
          heading: '作图技巧：',
          lines: ['选原点→建坐标系→找分量→画晶向→标指数'],
          stepsHeading: '作图步骤：',
          steps: [
            '建系定原点：以晶胞顶点为原点建立右手直角坐标系。',
            '找分量连线：从原点出发，沿坐标轴找到方向分量(u, v, w)的目标点，从原点向该点连线并画出箭头。',
          ],
          notes: [
            '负号平移：哪个轴带有负号，原点就向该轴正方向平移1个晶胞边长。',
            '大数字缩小：若指数数值大于1（如[112]），需同除以最大数进行等比缩小（变为[1/2, 1/2, 1]），确保终点落在单个晶胞内部。',
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
          {drawing?.mode === 'plane' && <><dt>相对截距：</dt><dd className="drawing-intercepts">
            <span>{drawing.indices.map((value, i) => <span className="drawing-info-line" key={i}>{(isHexagonal ? ['a₁', 'a₂', 'a₃', 'c'] : ['X', 'Y', 'Z'])[i]}：{interceptText(value, drawing.planeLevel)}</span>)}</span>
            {isHexagonal && drawing.planeLevel !== 1 && <p className="drawing-plane-note" role="note">
              当前显示第 {drawing.planeLevel} 层平行晶面，实际截距按 {drawing.planeLevel}/h、{drawing.planeLevel}/k、{drawing.planeLevel}/i、{drawing.planeLevel}/l 计算；指数为 0 的轴仍与晶面平行。
            </p>}
          </dd></>}
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
          <h3>{teaching.stepsHeading ?? '【绘制步骤】'}</h3>
          {teaching.steps && <ol>{teaching.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
          {teaching.methods?.map((method) => <div className="drawing-teaching-method" key={method.title}>
            <h4>{method.title}</h4>
            <p>{method.text}</p>
          </div>)}
          {teaching.notes && <>
            <h3>注意事项：</h3>
            {typeof teaching.notes === 'string'
              ? <p>{teaching.notes}</p>
              : <ol>{teaching.notes.map((note) => <li key={note}>{note}</li>)}</ol>}
          </>}
        </div>
      </section>
    </aside>
  );
}
