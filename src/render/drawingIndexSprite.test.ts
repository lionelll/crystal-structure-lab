import { describe, expect, it } from 'vitest';
import { layoutDrawingIndex } from './drawingIndexSprite';

describe('drawing index label layout', () => {
  const measure = (text: string) => text.length * 10;

  it('marks only the negative index run for an overbar', () => {
    const layout = layoutDrawingIndex('plane', [1, -2, 1], measure);
    expect(layout.runs.map(({ text, negative }) => ({ text, negative }))).toEqual([
      { text: '(', negative: false },
      { text: '1', negative: false },
      { text: '', negative: false },
      { text: '2', negative: true },
      { text: '', negative: false },
      { text: '1', negative: false },
      { text: ')', negative: false },
    ]);
    const negative = layout.runs.filter((run) => run.negative);
    expect(negative).toHaveLength(1);
    expect(negative[0]).toMatchObject({ text: '2', x: 20, width: 10 });
  });

  it('keeps spacing between multi-digit indices outside the overbar', () => {
    const layout = layoutDrawingIndex('direction', [12, -2, 1], measure);
    expect(layout.runs.filter((run) => run.negative)).toEqual([
      { text: '2', negative: true, x: 40, width: 10 },
    ]);
    expect(layout.width).toBe(80);
  });

  it('lays out four-index hexagonal labels without widening an adjacent overbar', () => {
    const layout = layoutDrawingIndex('plane', [1, 0, -1, 0], measure);
    expect(layout.runs.filter((run) => run.negative)).toEqual([
      { text: '1', negative: true, x: 30, width: 10 },
    ]);
    expect(layout.width).toBe(60);
  });
});
