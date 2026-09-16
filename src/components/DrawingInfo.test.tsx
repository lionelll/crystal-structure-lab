import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCrystalDrawing } from '../core/crystalDrawing';
import { drawingReducer, initialDrawingState } from '../core/drawingState';
import { DrawingInfo } from './DrawingInfo';

describe('drawing information panel', () => {
  it.each([
    { crystalSystem: 'cubic', mode: 'plane', heading: '【核心口诀】', lineCount: 1, stepCount: 3, text: '定原点→建坐标系→求截距' },
    { crystalSystem: 'cubic', mode: 'direction', heading: '【核心口诀】', lineCount: 1, stepCount: 3, text: '定原点→建坐标系→求分量' },
    { crystalSystem: 'hexagonal', mode: 'plane', heading: '【核心公式】', lineCount: 1, stepCount: 2, text: 'i=-(h+k)' },
    { crystalSystem: 'hexagonal', mode: 'direction', heading: '【核心公式】', lineCount: 2, stepCount: 2, text: 'u=(2U-V)/3,  v=(2V-U)/3,  t=-(u+v),  w=W' },
  ] as const)('separates teaching headings and numbered steps for $crystalSystem $mode', ({ crystalSystem, mode, heading, lineCount, stepCount, text }) => {
    let state = drawingReducer(initialDrawingState(), { type: 'system', crystalSystem });
    state = drawingReducer(state, { type: 'mode', mode });
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);
    expect(html).toContain(`<h3>${heading}</h3><p>`);
    expect(html).toContain('<h3>【绘制步骤】</h3><ol><li>');
    expect(html.match(/<p>/g)).toHaveLength(lineCount);
    expect(html.match(/<li>/g)).toHaveLength(stepCount);
    expect(html.match(/<\/li><li>/g)).toHaveLength(stepCount - 1);
    expect(html).toContain(text);
    expect(html).not.toMatch(/<p>【/);
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
    expect(html).toContain('定原点→建坐标系→求分量');
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
