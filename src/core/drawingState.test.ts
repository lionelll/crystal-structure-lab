import { describe, expect, it } from 'vitest';
import { drawingReducer, initialDrawingState } from './drawingState';

describe('drawing interaction state', () => {
  it('enters paused with an empty board and 111 draft', () => {
    expect(initialDrawingState()).toEqual({ mode: 'plane', draft: ['1', '1', '1'], applied: null, error: null, autoRotate: false });
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
});
