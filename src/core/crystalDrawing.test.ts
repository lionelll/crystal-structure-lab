import { describe, expect, it } from 'vitest';
import { createCrystalDrawing, createHexagonalDrawing, drawingIndexTokens, drawingOrigin, fractionText, hexagonalPlaneCoordinate, hexagonalPlaneLevel, hexagonalPlaneVertices, interceptText, parseHexIndices, parseIndices, type Point3, type Point4 } from './crystalDrawing';

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
    expect(drawingIndexTokens([1, -2, 1])).toEqual([
      { text: '1', negative: false },
      { text: '2', negative: true },
      { text: '1', negative: false },
    ]);
    expect(fractionText(-2, 4)).toBe('-1/2');
    expect(fractionText(0, 4)).toBe('0');
  });

  it('enforces the Miller-Bravais basal constraint', () => {
    expect(parseHexIndices(['1', '0', '-1', '0'])).toEqual([1, 0, -1, 0]);
    expect(() => parseHexIndices(['1', '0', '0', '0'])).toThrow('必须满足');
    expect(() => parseHexIndices(['0', '0', '0', '0'])).toThrow('不能同时');
  });

  it.each([
    [[0, 0, 0, 1], 6],
    [[1, 0, -1, 0], 4],
    [[1, 0, -1, 1], 4],
  ] as const)('clips hexagonal plane %j to the prism', (indices, minimumVertices) => {
    const point4 = [...indices] as Point4;
    const level = hexagonalPlaneLevel(point4);
    const vertices = hexagonalPlaneVertices(point4);
    expect(vertices.length).toBeGreaterThanOrEqual(minimumVertices);
    for (const [x, y, z] of vertices) {
      expect(Math.abs(z)).toBeLessThanOrEqual(0.5 + 1e-10);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(0.5 + 1e-10);
      expect(hexagonalPlaneCoordinate(point4, [x, y, z])).toBeCloseTo(level, 12);
    }
  });

  it('places (0001) on the top basal lattice plane instead of a centre slice', () => {
    const indices: Point4 = [0, 0, 0, 1];
    const drawing = createHexagonalDrawing('plane', indices);
    if (drawing.mode !== 'plane') throw new Error('wrong mode');
    expect(drawing.planeLevel).toBe(1);
    expect(drawing.vertices).toHaveLength(6);
    expect(drawing.vertices.every((point) => Math.abs(point[2] - 0.5) < 1e-12)).toBe(true);
    expect(interceptText(indices[3], drawing.planeLevel)).toBe('1a');
  });

  it('places (10-10) on a vertical prism side and keeps its displayed intercepts consistent', () => {
    const indices: Point4 = [1, 0, -1, 0];
    const drawing = createHexagonalDrawing('plane', indices);
    if (drawing.mode !== 'plane') throw new Error('wrong mode');
    expect(drawing.vertices).toHaveLength(4);
    expect(drawing.vertices.every((point) => Math.abs(hexagonalPlaneCoordinate(indices, point) - 1) < 1e-12)).toBe(true);
    expect(interceptText(indices[0], drawing.planeLevel)).toBe('1a');
    expect(interceptText(indices[2], drawing.planeLevel)).toBe('-1a');
  });

  it('uses an intersecting negative lattice level for a negative basal normal', () => {
    const drawing = createHexagonalDrawing('plane', [0, 0, 0, -1]);
    if (drawing.mode !== 'plane') throw new Error('wrong mode');
    expect(drawing.planeLevel).toBe(-1);
    expect(drawing.vertices.every((point) => Math.abs(point[2] - 0.5) < 1e-12)).toBe(true);
    expect(interceptText(-1, drawing.planeLevel)).toBe('1a');
  });

  it('draws four-index hexagonal directions inside the prism', () => {
    const drawing = createHexagonalDrawing('direction', [2, -1, -1, 0]);
    if (drawing.mode !== 'direction') throw new Error('wrong mode');
    expect(drawing.crystalSystem).toBe('hexagonal');
    expect(drawing.end[0]).toBeGreaterThan(drawing.origin[0]);
    expect(drawing.end[1]).toBeCloseTo(drawing.origin[1], 12);
    expect(Math.hypot(drawing.end[0], drawing.end[1])).toBeLessThanOrEqual(0.5 + 1e-10);
  });
});
