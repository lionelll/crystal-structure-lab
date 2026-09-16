import { describe, expect, it } from 'vitest';
import { createHexagonalDrawing, type Point3, type Point4 } from './crystalDrawing';
import { dependentHexIndex, fourToThreeIndices, threeToFourIndices } from './hexagonalIndices';

describe('hexagonal index conversion', () => {
  it.each([
    [[1, 0, 0], [2, -1, -1, 0]],
    [[1, 1, 0], [1, 1, -2, 0]],
    [[1, 0, 1], [2, -1, -1, 3]],
    [[1, 2, 1], [0, 1, -1, 1]],
    [[0, 0, -1], [0, 0, 0, -1]],
  ])('converts direction %j to %j, including the c component', (three, four) => {
    expect(threeToFourIndices('direction', three as Point3)).toEqual(four);
    expect(fourToThreeIndices('direction', four as Point4)).toEqual(three);
  });

  it('preserves plane indices and intercepts rather than using the direction formula', () => {
    const indices = threeToFourIndices('plane', [2, -4, 2]);
    expect(indices).toEqual([2, -4, 2, 2]);
    expect(fourToThreeIndices('plane', indices)).toEqual([2, -4, 2]);
    expect(createHexagonalDrawing('plane', indices)).toEqual(createHexagonalDrawing('plane', [2, -4, 2, 2]));
  });

  it('preserves direction and sign for every small nonzero three-index combination', () => {
    for (let U = -3; U <= 3; U++) for (let V = -3; V <= 3; V++) for (let W = -3; W <= 3; W++) {
      if (U === 0 && V === 0 && W === 0) continue;
      const four = threeToFourIndices('direction', [U, V, W]);
      expect(four[0] + four[1] + four[2]).toBe(0);
      const vector = [U - V / 2, Math.sqrt(3) * V / 2, W];
      const drawing = createHexagonalDrawing('direction', four);
      if (drawing.mode !== 'direction') throw new Error('Expected direction');
      const end = drawing.end.map((value, index) => value - drawing.origin[index]);
      for (let axis = 0; axis < 3; axis++) {
        expect(end[axis] / Math.hypot(...end)).toBeCloseTo(vector[axis] / Math.hypot(...vector), 10);
      }
      expect(threeToFourIndices('direction', fourToThreeIndices('direction', four))).toEqual(four);
    }
  });

  it('uses exact integer intermediates and rejects unrepresentable results', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(threeToFourIndices('direction', [max, max, max])).toEqual([1, 1, -2, 3]);
    expect(() => threeToFourIndices('plane', [max, max, 1])).toThrow('超出');
    expect(() => threeToFourIndices('direction', [max, 0, 1])).toThrow('超出');
    expect(() => threeToFourIndices('direction', [0, 0, 0])).toThrow('不能同时');
    expect(() => fourToThreeIndices('direction', [1, 1, 1, 0])).toThrow('必须满足');
  });

  it.each(['', ' ', '-', '+', 'x', '1.5', '1e2'])('does not treat the incomplete value %j as an integer', (value) => {
    expect(dependentHexIndex(value, '1')).toBe('');
  });
});
