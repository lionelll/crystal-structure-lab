import { describe, expect, it } from 'vitest';
import { createCrystalDrawing, drawingOrigin, formatDrawingIndex, fractionText, interceptText, parseIndices, type Point3 } from './crystalDrawing';

describe('crystal drawing geometry', () => {
  it.each<[Point3, number]>([
    [[1, 0, 0], 4], [[0, 1, 0], 4], [[0, 0, 1], 4],
    [[1, 1, 0], 4], [[1, 1, 1], 3], [[2, 1, 0], 4],
    [[-1, 1, 1], 3], [[-1, -1, 0], 4], [[-1, -1, -1], 3],
  ])('clips plane %j to the cell with %i corners', (indices, count) => {
    const drawing = createCrystalDrawing('plane', indices);
    if (drawing.mode !== 'plane') throw new Error('wrong mode');
    expect(drawing.vertices).toHaveLength(count);
    for (const vertex of drawing.vertices) {
      expect(vertex.every((v) => v >= 0 && v <= 1)).toBe(true);
      expect(indices.reduce((sum, n, i) => sum + n * (vertex[i] - drawing.origin[i]), 0)).toBeCloseTo(1, 12);
    }
  });

  it('keeps the specified plane intercepts rather than silently reducing indices', () => {
    const result = createCrystalDrawing('plane', [2, 2, 0]);
    if (result.mode !== 'plane') throw new Error('wrong mode');
    expect(result.vertices).toContainEqual([0.5, 0, 0]);
    expect(result.vertices).toContainEqual([0, 0.5, 1]);
    expect(interceptText(2)).toBe('1/2a');
    expect(interceptText(-3)).toBe('-1/3a');
    expect(interceptText(0)).toBe('∞（平行）');
  });

  it('covers every sign and zero combination without escaping the cell', () => {
    for (let h = -3; h <= 3; h++) for (let k = -3; k <= 3; k++) for (let l = -3; l <= 3; l++) {
      if (h === 0 && k === 0 && l === 0) continue;
      const indices: Point3 = [h, k, l];
      const plane = createCrystalDrawing('plane', indices);
      const direction = createCrystalDrawing('direction', indices);
      if (plane.mode !== 'plane' || direction.mode !== 'direction') throw new Error('wrong mode');
      expect(plane.origin).toEqual(drawingOrigin(indices));
      expect(plane.vertices.length).toBeGreaterThanOrEqual(3);
      for (const vertex of plane.vertices) {
        expect(vertex.every((v) => v >= 0 && v <= 1)).toBe(true);
        expect(indices.reduce((sum, n, i) => sum + n * (vertex[i] - plane.origin[i]), 0)).toBeCloseTo(1, 12);
      }
      direction.end.forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect((v - direction.origin[i]) * direction.divisor).toBeCloseTo(indices[i], 12);
      });
    }
  });

  it('scales a mixed-sign high-index direction without changing its direction', () => {
    const result = createCrystalDrawing('direction', [-2, 1, 3]);
    if (result.mode !== 'direction') throw new Error('wrong mode');
    expect(result.origin).toEqual([1, 0, 0]);
    expect(result.end[0]).toBeCloseTo(1 / 3);
    expect(result.end[1]).toBeCloseTo(1 / 3);
    expect(result.end[2]).toBe(1);
  });

  it.each(['', '-', '1.2', 'NaN', 'Infinity', '1e3', '9007199254740992'])('rejects invalid index %s', (input) => {
    expect(() => parseIndices([input, '1', '1'])).toThrow();
  });
  it('rejects all zeros and accepts explicitly signed integers', () => {
    expect(() => parseIndices(['0', '-0', '+0'])).toThrow('不能同时');
    expect(parseIndices(['-2', '+1', ' 0 '])).toEqual([-2, 1, 0]);
  });
  it('formats negative indices with bars and exact rational values', () => {
    expect(formatDrawingIndex('plane', [-1, 1, 0])).toBe('(1\u030510)');
    expect(formatDrawingIndex('direction', [12, 1, 0])).toBe('[12 1 0]');
    expect(fractionText(-2, 4)).toBe('-1/2');
    expect(fractionText(0, 4)).toBe('0');
  });
});
