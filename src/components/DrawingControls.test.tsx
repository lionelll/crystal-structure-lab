import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { initialDrawingState } from '../core/drawingState';
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
});
