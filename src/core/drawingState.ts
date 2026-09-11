import { createCrystalDrawing, parseIndices, type CrystalDrawing, type DrawingMode, type IndexDraft } from './crystalDrawing';

export interface DrawingState {
  mode: DrawingMode;
  draft: IndexDraft;
  applied: CrystalDrawing | null;
  error: string | null;
  autoRotate: boolean;
}

export type DrawingAction =
  | { type: 'edit'; index: number; value: string }
  | { type: 'mode'; mode: DrawingMode }
  | { type: 'rotate'; value: boolean }
  | { type: 'draw' | 'clear' | 'reset' };

export function initialDrawingState(): DrawingState {
  return { mode: 'plane', draft: ['1', '1', '1'], applied: null, error: null, autoRotate: false };
}

export function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'edit': {
      const draft: IndexDraft = [...state.draft];
      draft[action.index] = action.value;
      return { ...state, draft, error: null };
    }
    case 'mode':
      return action.mode === state.mode ? state : { ...state, mode: action.mode, applied: null, error: null };
    case 'rotate':
      return { ...state, autoRotate: action.value };
    case 'clear':
      return { ...state, applied: null, error: null };
    case 'reset':
      return initialDrawingState();
    case 'draw':
      try {
        return { ...state, applied: createCrystalDrawing(state.mode, parseIndices(state.draft)), error: null };
      } catch (error) {
        return { ...state, error: error instanceof Error ? error.message : '无法绘制，请检查指数。' };
      }
  }
}
