import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCrystalDrawing } from '../core/crystalDrawing';
import { initialDrawingState } from '../core/drawingState';
import { DrawingInfo } from './DrawingInfo';

describe('drawing information panel', () => {
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
