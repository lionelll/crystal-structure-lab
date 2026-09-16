import { createCrystalDrawing, createHexagonalDrawing, parseHexIndices, parseIndices, type CrystalDrawing, type DrawingCrystalSystem, type DrawingMode, type HexIndexDraft, type IndexDraft } from './crystalDrawing';

export interface DrawingState {
  crystalSystem: DrawingCrystalSystem;
  mode: DrawingMode;
  draft: IndexDraft | HexIndexDraft;
  applied: CrystalDrawing | null;
  error: string | null;
  autoRotate: boolean;
}

export type DrawingAction =
  | { type: 'edit'; index: number; value: string }
  | { type: 'system'; crystalSystem: DrawingCrystalSystem }
  | { type: 'mode'; mode: DrawingMode }
  | { type: 'rotate'; value: boolean }
  | { type: 'draw' | 'clear' | 'reset' };

export function initialDrawingState(): DrawingState {
  return { crystalSystem: 'cubic', mode: 'plane', draft: ['1', '1', '1'], applied: null, error: null, autoRotate: false };
}

const defaultDraft = (crystalSystem: DrawingCrystalSystem): IndexDraft | HexIndexDraft => (
  crystalSystem === 'cubic' ? ['1', '1', '1'] : ['1', '0', '-1', '0']
);

export function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'edit': {
      const draft = [...state.draft] as IndexDraft | HexIndexDraft;
      draft[action.index] = action.value;
      if (state.crystalSystem === 'hexagonal' && (action.index === 0 || action.index === 1)) {
        const first = Number(draft[0]);
        const second = Number(draft[1]);
        draft[2] = Number.isSafeInteger(first) && Number.isSafeInteger(second) ? String(-(first + second)) : '';
      }
      return { ...state, draft, error: null };
    }
    case 'system':
      return action.crystalSystem === state.crystalSystem ? state : {
        ...state,
        crystalSystem: action.crystalSystem,
        draft: defaultDraft(action.crystalSystem),
        applied: null,
        error: null,
      };
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
        const applied = state.crystalSystem === 'cubic'
          ? createCrystalDrawing(state.mode, parseIndices(state.draft as IndexDraft))
          : createHexagonalDrawing(state.mode, parseHexIndices(state.draft as HexIndexDraft));
        return { ...state, applied, error: null };
      } catch (error) {
        return { ...state, error: error instanceof Error ? error.message : '无法绘制，请检查指数。' };
      }
  }
}
