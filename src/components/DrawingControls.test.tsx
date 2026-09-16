import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { drawingReducer, initialDrawingState } from '../core/drawingState';
import { DrawingControls } from './DrawingControls';

describe('drawing controls', () => {
  it('offers cubic and hexagonal systems', () => {
    const html = renderToStaticMarkup(<DrawingControls state={initialDrawingState()} dispatch={vi.fn()} />);
    expect(html).toContain('立方晶系');
    expect(html).toContain('六方晶系');
    expect(html).toContain('晶面 (hkl)');
  });

  it('shows the constrained four-index editor for hexagonal drawings', () => {
    const state = initialDrawingState();
    state.crystalSystem = 'hexagonal';
    state.draft = ['1', '0', '-1', '0'];
    const html = renderToStaticMarkup(<DrawingControls state={state} dispatch={vi.fn()} />);
    expect(html).toContain('晶面 (hkil)');
    expect(html).toContain('i = -(h + k)');
    expect(html).toContain('aria-label="i 指数"');
    expect(html).toContain('readOnly');
  });

  it.each(['plane', 'direction'] as const)('offers both editable index rows in hexagonal %s mode', (mode) => {
    let state = drawingReducer(initialDrawingState(), { type: 'system', crystalSystem: 'hexagonal' });
    state = drawingReducer(state, { type: 'mode', mode });
    const html = renderToStaticMarkup(<DrawingControls state={state} dispatch={vi.fn()} />);
    expect(html).toContain('四轴指数');
    expect(html).toContain('三轴指数');
    expect(html.match(/type="text"/g)).toHaveLength(7);
    expect(html.match(/readOnly/g)).toHaveLength(1);
    for (const name of mode === 'plane' ? ['h', 'k', 'l'] : ['U', 'V', 'W']) expect(html).toContain(`aria-label="三轴 ${name} 指数"`);
  });

  it('leaves the cubic editor with exactly three inputs', () => {
    const html = renderToStaticMarkup(<DrawingControls state={initialDrawingState()} dispatch={vi.fn()} />);
    expect(html.match(/type="text"/g)).toHaveLength(3);
    expect(html).not.toContain('三轴指数');
  });
});
