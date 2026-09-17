import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCrystalDrawing, createHexagonalDrawing } from '../core/crystalDrawing';
import { drawingReducer, initialDrawingState } from '../core/drawingState';
import { DrawingInfo } from './DrawingInfo';

describe('drawing information panel', () => {
  it.each([
    { drawing: createCrystalDrawing('plane', [1, -1, 0]), lines: ['X：1', 'Y：-1', 'Z：∞（平行）'] },
    { drawing: createCrystalDrawing('plane', [2, -3, 1]), lines: ['X：1/2', 'Y：-1/3', 'Z：1'] },
    { drawing: createHexagonalDrawing('plane', [1, 0, -1, 0]), lines: ['a₁：1', 'a₂：∞（平行）', 'a₃：-1', 'c：∞（平行）'] },
    { drawing: createHexagonalDrawing('plane', [2, 0, -2, 1]), lines: ['a₁：1/2', 'a₂：∞（平行）', 'a₃：-1/2', 'c：1'] },
    { drawing: createHexagonalDrawing('plane', [0, 0, 0, -1]), lines: ['a₁：∞（平行）', 'a₂：∞（平行）', 'a₃：∞（平行）', 'c：1'] },
  ])('shows numeric intercepts without unit suffixes, preserving axes: $lines', ({ drawing, lines }) => {
    const state = initialDrawingState();
    state.crystalSystem = drawing.crystalSystem;
    state.applied = drawing;
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    const renderedLines = Array.from(html.matchAll(/<span class="drawing-info-line">([^<]*)<\/span>/g), (match) => match[1]);
    expect(renderedLines).toEqual(lines);
  });

  it.each([
    { crystalSystem: 'cubic', mode: 'plane', lineCount: 1, stepCount: 4, text: '选原点→建坐标系→取截距→画晶面→标指数' },
    { crystalSystem: 'cubic', mode: 'direction', lineCount: 1, stepCount: 4, text: '选原点→建坐标系→找分量→画晶向→标指数' },
    { crystalSystem: 'hexagonal', mode: 'plane', lineCount: 1, stepCount: 6, text: '选原点→四轴取截距→标点连面→标指数' },
    { crystalSystem: 'hexagonal', mode: 'direction', lineCount: 4, stepCount: 0, text: '选原点→矢量合成（或转三轴）→确定终点→连线标向' },
  ] as const)('separates teaching headings and numbered steps for $crystalSystem $mode', ({ crystalSystem, mode, lineCount, stepCount, text }) => {
    let state = drawingReducer(initialDrawingState(), { type: 'system', crystalSystem });
    state = drawingReducer(state, { type: 'mode', mode });
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    const isHexDirection = crystalSystem === 'hexagonal' && mode === 'direction';
    expect(html.match(/<h3>([^<]*)<\/h3>/g)).toEqual(['<h3>作图技巧：</h3>', '<h3>作图步骤：</h3>', '<h3>注意事项：</h3>']);
    expect(html).toContain('<h3>作图技巧：</h3><p>');
    if (!isHexDirection) expect(html).toContain('<h3>作图步骤：</h3><ol><li>');
    expect(html.match(/<h4>/g) ?? []).toHaveLength(isHexDirection ? 2 : 0);
    expect(html.match(/<ol>/g) ?? []).toHaveLength(isHexDirection ? 0 : 2);
    expect(html.match(/<p>/g)).toHaveLength(lineCount);
    expect(html.match(/<li>/g) ?? []).toHaveLength(stepCount);
    expect(html.match(/<\/li><li>/g) ?? []).toHaveLength(isHexDirection ? 0 : stepCount - 2);
    expect(html).toContain(text);
    expect(html).not.toMatch(/<p>【/);
    expect(html).not.toMatch(/【核心口诀】|【核心公式】|【绘制步骤】/);
  });

  it.each(([
    {
      crystalSystem: 'cubic', mode: 'plane',
      sections: [
        '<h3>作图步骤：</h3><ol><li>算截距定原点：先取晶面指数(hkl)的倒数作为各轴截距（1/h, 1/k, 1/l）。</li><li>标截距连晶面：在各晶轴上标出截距点并连成多边形（截面）。</li></ol>',
        '<h3>注意事项：</h3><ol><li>数字0表平行：指数为0时，其倒数为无穷大，表示晶面与该坐标轴平行（连线时沿该轴方向平移拉伸成面）。</li><li>负号平移：哪个轴带有负号，原点就向该轴正方向平移1个晶胞边长。</li></ol>',
      ],
    },
    {
      crystalSystem: 'hexagonal', mode: 'direction',
      sections: [
        '<h4>方法一（四轴直接合成法）：</h4><p>从原点出发，底面沿a1,a2,a3轴分别截取u,v,t分量，利用平行四边形法则合成为底面矢量，再沿c轴按w的正负方向叠加分量到达终点，连线画出箭头。</p>',
        '<h4>方法二（转三轴简易法）：</h4><p>利用公式 U=2u+v, V=2v+u, W=w（或 U=u-t, V=v-t）转换为三轴指数 [UVW]，仅在a1,a2,c三轴系中定点连线。</p>',
        '<h3>注意事项：</h3><p>基面负分量沿对应轴反方向参与矢量合成，无需逐轴平移原点。本图 w≥0 时取底面中心，w&lt;0 时取顶面中心；晶向保持不变，长度等比例缩放至晶胞边界。</p>',
      ],
    },
    {
      crystalSystem: 'hexagonal', mode: 'plane',
      sections: [
        '<h3>作图步骤：</h3><ol><li>求截距：取指数倒数，分别求出基准晶面在a1,a2,a3,c四个轴上的截距 (1/h,1/k,1/i,1/l)。</li><li>标点连线：在底面三轴及高轴c上标出截距点，连接并延伸得到晶胞内的截面（底面上的有限截距点共线）。</li></ol>',
        '<h3>注意事项：</h3><ol><li>数字 0：倒数为 ∞，表示晶面与该轴平行（沿该轴平移拉伸成面）。</li><li>原点与负号：本图原点固定在底面中心，负截距位于对应轴的负方向，不按负指数逐轴平移原点。</li><li>平行晶面：若基准晶面不能在晶胞内形成完整截面，则选取同组平行晶面；实际截距按层级 m 除以对应指数计算。</li><li>恒等校验：必须满足 i=-(h+k)。</li></ol>',
      ],
    },
  ] as const).flatMap((testCase) => [false, true].map((drawn) => ({ ...testCase, drawn }))))('shows the supplied $crystalSystem $mode guidance (drawn=$drawn)', ({ crystalSystem, mode, sections, drawn }) => {
    let state = drawingReducer(initialDrawingState(), { type: 'system', crystalSystem });
    state = drawingReducer(state, { type: 'mode', mode });
    if (drawn) state = drawingReducer(state, { type: 'draw' });
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    for (const section of sections) expect(html).toContain(section);
    expect(html).not.toContain('。。');
  });

  it.each([false, true])('shows the supplied cubic direction guidance before and after drawing (drawn=%s)', (drawn) => {
    let state = drawingReducer(initialDrawingState(), { type: 'mode', mode: 'direction' });
    if (drawn) state = drawingReducer(state, { type: 'draw' });
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    expect(html).toContain('<h3>作图技巧：</h3><p>选原点→建坐标系→找分量→画晶向→标指数</p>');
    expect(html).toContain('<h3>作图步骤：</h3><ol><li>建系定原点：以晶胞顶点为原点建立右手直角坐标系。</li><li>找分量连线：从原点出发，沿坐标轴找到方向分量(u, v, w)的目标点，从原点向该点连线并画出箭头。</li></ol>');
    expect(html).toContain('<h3>注意事项：</h3><ol><li>负号平移：哪个轴带有负号，原点就向该轴正方向平移1个晶胞边长。</li><li>大数字缩小：若指数数值大于1（如[112]），需同除以最大数进行等比缩小（变为[1/2, 1/2, 1]），确保终点落在单个晶胞内部。</li></ol>');
    expect(html).not.toContain('【核心口诀】');
    expect(html).not.toContain('【绘制步骤】');
  });

  it.each((['cubic', 'hexagonal'] as const).flatMap((crystalSystem) =>
    (['plane', 'direction'] as const).flatMap((mode) =>
      [false, true].map((drawn) => ({ crystalSystem, mode, drawn }))),
  ))('omits origin and direction ratio for $crystalSystem $mode (drawn=$drawn)', ({ crystalSystem, mode, drawn }) => {
    let state = drawingReducer(initialDrawingState(), { type: 'system', crystalSystem });
    state = drawingReducer(state, { type: 'mode', mode });
    if (drawn) state = drawingReducer(state, { type: 'draw' });
    expect(state.error).toBeNull();
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    expect(html).not.toContain('原点位置');
    expect(html).not.toContain('方向比例');
    for (const field of ['绘制类型', '绘图晶胞', '当前指数', '教学解析']) expect(html).toContain(field);
    if (drawn) expect(html).toContain(mode === 'plane' ? '相对截距' : '相对终点');
    else expect(html).toContain('未绘制');
  });

  it('shows the cubic drawing cell and the matching teaching section', () => {
    const state = initialDrawingState();
    state.mode = 'direction';
    state.applied = createCrystalDrawing('direction', [1, -2, 1]);
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);

    expect(html).toContain('当前信息');
    expect(html).toContain('当前指数');
    expect(html).toContain('绘图晶胞');
    expect(html).toContain('立方晶胞');
    expect(html).toContain('教学解析');
    expect(html).toContain('选原点→建坐标系→找分量');
  });

  it('shows four-index notation and hexagonal teaching for the hexagonal system', () => {
    const state = initialDrawingState();
    state.crystalSystem = 'hexagonal';
    state.mode = 'plane';
    state.draft = ['1', '0', '-1', '0'];
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    expect(html).toContain('晶面 (hkil)');
    expect(html).toContain('六方晶胞');
    expect(html).toContain('i=-(h+k)');
  });

  it('wraps only the negative value in the overbar class', () => {
    const state = initialDrawingState();
    state.applied = createCrystalDrawing('plane', [1, -2, 1]);
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);

    expect(html.match(/drawing-index-token is-negative/g)).toHaveLength(1);
    expect(html).toContain('drawing-index-token is-negative">2</span>');
    expect(html).toContain('aria-label="晶面指数：1、负2、1"');
  });
});
