import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createCrystalDrawing } from '../core/crystalDrawing';
import { initialDrawingState } from '../core/drawingState';
import { DrawingInfo } from './DrawingInfo';

describe('drawing information panel', () => {
  it('shows only current drawing information without cell or teaching sections', () => {
    const state = initialDrawingState();
    state.mode = 'direction';
    state.applied = createCrystalDrawing('direction', [1, -2, 1]);
    const html = renderToStaticMarkup(<DrawingInfo state={state} />);

    expect(html).toContain('当前信息');
    expect(html).toContain('当前指数');
    expect(html).not.toContain('绘图晶胞');
    expect(html).not.toContain('教学解析');
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
