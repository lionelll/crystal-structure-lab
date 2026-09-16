import { describe, expect, it } from 'vitest';
import { drawingReducer, initialDrawingState } from './drawingState';

describe('drawing interaction state', () => {
  it('enters paused with an empty board and 111 draft', () => {
    expect(initialDrawingState()).toEqual({ crystalSystem: 'cubic', mode: 'plane', draft: ['1', '1', '1'], threeAxisDraft: null, inputBasis: 'four', applied: null, error: null, autoRotate: false });
  });
  it('typing does not replace the committed drawing; invalid generation preserves it', () => {
    const generated = drawingReducer(initialDrawingState(), { type: 'draw' });
    const edited = drawingReducer(generated, { type: 'edit', index: 0, value: '-' });
    expect(edited.applied).toBe(generated.applied);
    const invalid = drawingReducer(edited, { type: 'draw' });
    expect(invalid.applied).toBe(generated.applied);
    expect(invalid.error).toBeTruthy();
  });
  it('clearing keeps inputs and rotation but drops the entire drawing', () => {
    let state = drawingReducer(initialDrawingState(), { type: 'edit', index: 0, value: '-1' });
    state = drawingReducer(state, { type: 'draw' });
    state = drawingReducer(state, { type: 'rotate', value: true });
    const cleared = drawingReducer(state, { type: 'clear' });
    expect(cleared.applied).toBeNull();
    expect(cleared.draft).toEqual(['-1', '1', '1']);
    expect(cleared.autoRotate).toBe(true);
  });
  it('mode switching clears geometry; reentry resets all transient drawing state', () => {
    const generated = drawingReducer(initialDrawingState(), { type: 'draw' });
    const switched = drawingReducer(generated, { type: 'mode', mode: 'direction' });
    expect(switched.applied).toBeNull();
    expect(switched.draft).toEqual(generated.draft);
    const rotating = drawingReducer(switched, { type: 'rotate', value: true });
    expect(drawingReducer(rotating, { type: 'reset' })).toEqual(initialDrawingState());
  });
  it('rapid draws retain only the latest result', () => {
    let state = initialDrawingState();
    for (const index of ['1', '-2', '3', '-1']) {
      state = drawingReducer(state, { type: 'edit', index: 0, value: index });
      state = drawingReducer(state, { type: 'draw' });
    }
    expect(state.applied?.indices).toEqual([-1, 1, 1]);
    expect(state.applied?.origin).toEqual([1, 0, 0]);
  });
  it('switches to a constrained four-index hexagonal draft and generates hexagonal geometry', () => {
    let state = drawingReducer(initialDrawingState(), { type: 'system', crystalSystem: 'hexagonal' });
    expect(state.draft).toEqual(['1', '0', '-1', '0']);
    state = drawingReducer(state, { type: 'edit', index: 1, value: '1' });
    expect(state.draft).toEqual(['1', '1', '-2', '0']);
    state = drawingReducer(state, { type: 'draw' });
    expect(state.applied?.crystalSystem).toBe('hexagonal');
    expect(state.applied?.indices).toEqual([1, 1, -2, 0]);
  });
});

describe('linked hexagonal editors', () => {
  const initialHex = () => drawingReducer(initialDrawingState(), { type: 'system', crystalSystem: 'hexagonal' });

  it('initializes both rows and synchronizes in both directions', () => {
    let state = initialHex();
    expect(state.threeAxisDraft).toEqual(['1', '0', '0']);
    state = drawingReducer(state, { type: 'editThree', index: 1, value: '-2' });
    expect(state.draft).toEqual(['1', '-2', '1', '0']);
    state = drawingReducer(state, { type: 'draw' });
    expect(state.applied?.indices).toEqual([1, -2, 1, 0]);
    state = drawingReducer(state, { type: 'edit', index: 3, value: '2' });
    expect(state.threeAxisDraft).toEqual(['1', '-2', '2']);
    expect(state.inputBasis).toBe('four');
    expect(drawingReducer(state, { type: 'edit', index: 2, value: '9' })).toBe(state);
  });

  it('converts direction input without overwriting the row being typed', () => {
    let state = drawingReducer(initialHex(), { type: 'mode', mode: 'direction' });
    expect(state.threeAxisDraft).toEqual(['2', '1', '0']);
    for (const [index, value] of ['1', '0', '1'].entries()) state = drawingReducer(state, { type: 'editThree', index, value });
    expect(state.threeAxisDraft).toEqual(['1', '0', '1']);
    expect(state.draft).toEqual(['2', '-1', '-1', '3']);
    expect(drawingReducer(state, { type: 'draw' }).applied?.indices).toEqual([2, -1, -1, 3]);
    state = drawingReducer(state, { type: 'edit', index: 3, value: '0' });
    expect(state.threeAxisDraft).toEqual(['1', '0', '0']);
    expect(state.draft).toEqual(['2', '-1', '-1', '0']);
  });

  it.each(['', '-', 'x', '1.5', '9007199254740992'])('preserves the drawing while the three-axis row contains %j', (value) => {
    const generated = drawingReducer(initialHex(), { type: 'draw' });
    const edited = drawingReducer(generated, { type: 'editThree', index: 0, value });
    expect(edited.applied).toBe(generated.applied);
    expect(edited.threeAxisDraft?.[0]).toBe(value);
    expect(edited.draft).toEqual(['', '', '', '']);
    const failed = drawingReducer(edited, { type: 'draw' });
    expect(failed.error).toBeTruthy();
    expect(failed.applied).toBe(generated.applied);
    const recovered = drawingReducer(failed, { type: 'editThree', index: 0, value: '-1' });
    expect(recovered.draft).toEqual(['-1', '0', '1', '0']);
    expect(drawingReducer(recovered, { type: 'draw' }).error).toBeNull();
  });

  it('does not render a stale converted row after invalid four-axis input', () => {
    const generated = drawingReducer(initialHex(), { type: 'draw' });
    const edited = drawingReducer(generated, { type: 'edit', index: 0, value: '' });
    expect(edited.threeAxisDraft).toEqual(['', '', '']);
    expect(edited.draft).toEqual(['', '0', '', '0']);
    expect(drawingReducer(edited, { type: 'draw' }).applied).toBe(generated.applied);
  });

  it('recalculates the other row on mode switches using the last edited row', () => {
    let state = drawingReducer(initialHex(), { type: 'editThree', index: 2, value: '1' });
    state = drawingReducer(state, { type: 'mode', mode: 'direction' });
    expect(state.threeAxisDraft).toEqual(['1', '0', '1']);
    expect(state.draft).toEqual(['2', '-1', '-1', '3']);
    state = drawingReducer(state, { type: 'mode', mode: 'plane' });
    expect(state.draft).toEqual(['1', '0', '-1', '1']);
    state = drawingReducer(state, { type: 'edit', index: 0, value: '2' });
    state = drawingReducer(state, { type: 'mode', mode: 'direction' });
    expect(state.draft).toEqual(['2', '0', '-2', '1']);
    expect(state.threeAxisDraft).toEqual(['4', '2', '1']);
    expect(state.applied).toBeNull();
  });

  it('clears without losing either row, rejects zero, and resets when leaving hexagonal', () => {
    let state = drawingReducer(initialHex(), { type: 'editThree', index: 0, value: '0' });
    state = drawingReducer(state, { type: 'draw' });
    expect(state.error).toBe('三个指数不能同时为 0。');
    const clear = drawingReducer(state, { type: 'clear' });
    expect(clear.threeAxisDraft).toEqual(['0', '0', '0']);
    expect(clear.draft).toEqual(state.draft);
    expect(clear.error).toBeNull();
    state = drawingReducer(clear, { type: 'system', crystalSystem: 'cubic' });
    expect(state.threeAxisDraft).toBeNull();
    expect(state.draft).toEqual(['1', '1', '1']);
    expect(drawingReducer(state, { type: 'draw' }).applied?.indices).toEqual([1, 1, 1]);
    expect(drawingReducer(state, { type: 'system', crystalSystem: 'hexagonal' })).toEqual(initialHex());
  });
});
