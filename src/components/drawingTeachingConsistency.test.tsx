import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createHexagonalDrawing, hexagonalPlaneCoordinate, type Point4 } from '../core/crystalDrawing';
import { drawingReducer, initialDrawingState, type DrawingState } from '../core/drawingState';
import { DrawingInfo } from './DrawingInfo';

const render = (state: DrawingState) => renderToStaticMarkup(<DrawingInfo state={state} />);
const hexState = () => drawingReducer(initialDrawingState(), { type: 'system', crystalSystem: 'hexagonal' });

describe('hexagonal drawing and teaching consistency', () => {
  it.each([
    { indices: [0, 0, 0, -1], height: 0.5, text: '1' },
    { indices: [0, 0, 0, -2], height: 0, text: '1/2' },
    { indices: [0, 0, 0, -3], height: -1 / 6, text: '1/3' },
  ])('explains the actual parallel-plane intercept for $indices', ({ indices, height, text }) => {
    const state = hexState();
    const plane = createHexagonalDrawing('plane', indices as Point4);
    if (plane.mode !== 'plane') throw new Error('wrong mode');
    state.applied = plane;
    expect(plane.origin).toEqual([0, 0, -0.5]);
    expect(plane.planeLevel).toBe(-1);
    for (const vertex of plane.vertices) {
      expect(vertex[2]).toBeCloseTo(height, 12);
      expect(indices[3] * (vertex[2] - plane.origin[2])).toBeCloseTo(-1, 12);
    }
    const html = render(state);
    expect(html).toContain(`c：${text}</span>`);
    expect(html).toContain('role="note"');
    expect(html).toContain('当前显示第 -1 层平行晶面，实际截距按 -1/h、-1/k、-1/i、-1/l 计算；指数为 0 的轴仍与晶面平行。');
    expect(html).toContain('基准晶面');
    expect(html).toContain('原点固定在底面中心');
    expect(html).not.toContain('原点沿该轴正方向平移');
  });

  it.each<Point4>([[0, 0, 0, 1], [1, 0, -1, 0], [-1, 0, 1, 0], [1, 0, -1, 1]])('does not claim a different layer for %j', (...indices) => {
    const state = hexState();
    const plane = createHexagonalDrawing('plane', indices);
    if (plane.mode !== 'plane') throw new Error('wrong mode');
    state.applied = plane;
    expect(plane.planeLevel).toBe(1);
    expect(plane.origin).toEqual([0, 0, -0.5]);
    const html = render(state);
    expect(html).not.toContain('role="note"');
    expect(html).toContain('原点固定在底面中心');
  });

  it.each<Point4>([[1, 0, -1, -1], [0, 1, -1, -1], [-1, 1, 0, -1]])('replaces an edge-only intersection with an explained parallel plane for %j', (...indices) => {
    const plane = createHexagonalDrawing('plane', indices);
    if (plane.mode !== 'plane') throw new Error('wrong mode');
    expect(plane.planeLevel).toBe(-1);
    expect(plane.vertices.length).toBeGreaterThanOrEqual(3);
    for (const vertex of plane.vertices) expect(hexagonalPlaneCoordinate(indices, vertex)).toBeCloseTo(-1, 12);
    const state = { ...hexState(), applied: plane };
    expect(render(state)).toContain('当前显示第 -1 层平行晶面');
  });

  it('produces a nonzero-area section for small valid hexagonal indices', () => {
    for (let h = -3; h <= 3; h++) for (let k = -3; k <= 3; k++) for (let l = -3; l <= 3; l++) {
      if (h === 0 && k === 0 && l === 0) continue;
      const indices: Point4 = [h, k, -h - k, l];
      const plane = createHexagonalDrawing('plane', indices);
      if (plane.mode !== 'plane') throw new Error('wrong mode');
      const area = [0, 0, 0];
      plane.vertices.forEach((a, index) => {
        const b = plane.vertices[(index + 1) % plane.vertices.length];
        area[0] += a[1] * b[2] - a[2] * b[1];
        area[1] += a[2] * b[0] - a[0] * b[2];
        area[2] += a[0] * b[1] - a[1] * b[0];
        expect(hexagonalPlaneCoordinate(indices, a)).toBeCloseTo(plane.planeLevel, 10);
      });
      expect(Math.hypot(...area)).toBeGreaterThan(1e-10);
    }
  });

  it.each<Point4>([[1, 0, -1, 0], [-1, 0, 1, 1], [1, -1, 0, -1]])('describes the actual direction origin for %j', (...indices) => {
    const state = drawingReducer(hexState(), { type: 'mode', mode: 'direction' });
    const direction = createHexagonalDrawing('direction', indices);
    if (direction.mode !== 'direction') throw new Error('wrong mode');
    state.applied = direction;
    expect(direction.origin).toEqual([0, 0, indices[3] < 0 ? 0.5 : -0.5]);
    const html = render(state);
    expect(html).toContain('基面负分量沿对应轴反方向参与矢量合成，无需逐轴平移原点。');
    expect(html).toContain('w≥0 时取底面中心，w&lt;0 时取顶面中心');
    expect(html).not.toContain('带有负号时同样需先平移原点');
    expect(html).not.toContain('role="note"');
  });

  it('keeps the explanation tied to the applied drawing and clears it on state transitions', () => {
    let state = hexState();
    for (const [index, value] of [[0, '0'], [3, '-1']] as const) state = drawingReducer(state, { type: 'edit', index, value });
    expect(render(state)).not.toContain('role="note"');
    state = drawingReducer(state, { type: 'draw' });
    expect(state.error).toBeNull();
    expect(render(state)).toContain('role="note"');
    const edited = drawingReducer(state, { type: 'edit', index: 3, value: '1' });
    expect(render(edited)).toContain('当前显示第 -1 层平行晶面');
    for (const action of [
      { type: 'clear' }, { type: 'mode', mode: 'direction' }, { type: 'system', crystalSystem: 'cubic' },
    ] as const) expect(render(drawingReducer(state, action))).not.toContain('role="note"');
    expect(render(drawingReducer(edited, { type: 'draw' }))).not.toContain('role="note"');
  });
});
