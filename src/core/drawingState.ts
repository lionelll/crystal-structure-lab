import { createCrystalDrawing, createHexagonalDrawing, parseHexIndices, parseIndices, type CrystalDrawing, type DrawingCrystalSystem, type DrawingMode, type HexIndexDraft, type IndexDraft } from './crystalDrawing';
import { dependentHexIndex, fourToThreeIndices, threeToFourIndices } from './hexagonalIndices';

export interface DrawingState {
  crystalSystem: DrawingCrystalSystem;
  mode: DrawingMode;
  draft: IndexDraft | HexIndexDraft;
  threeAxisDraft: IndexDraft | null;
  inputBasis: 'three' | 'four';
  applied: CrystalDrawing | null;
  error: string | null;
  autoRotate: boolean;
}

export type DrawingAction =
  | { type: 'edit'; index: number; value: string }
  | { type: 'editThree'; index: number; value: string }
  | { type: 'system'; crystalSystem: DrawingCrystalSystem }
  | { type: 'mode'; mode: DrawingMode }
  | { type: 'rotate'; value: boolean }
  | { type: 'draw' | 'clear' | 'reset' };

export function initialDrawingState(): DrawingState {
  return { crystalSystem: 'cubic', mode: 'plane', draft: ['1', '1', '1'], threeAxisDraft: null, inputBasis: 'four', applied: null, error: null, autoRotate: false };
}

const defaultDraft = (crystalSystem: DrawingCrystalSystem): IndexDraft | HexIndexDraft => (
  crystalSystem === 'cubic' ? ['1', '1', '1'] : ['1', '0', '-1', '0']
);

function syncHexDrafts(state: DrawingState): DrawingState {
  if (state.crystalSystem !== 'hexagonal') return state;
  try {
    return state.inputBasis === 'three'
      ? { ...state, draft: threeToFourIndices(state.mode, parseIndices(state.threeAxisDraft!)).map(String) as HexIndexDraft }
      : { ...state, threeAxisDraft: fourToThreeIndices(state.mode, parseHexIndices(state.draft as HexIndexDraft)).map(String) as IndexDraft };
  } catch {
    return state.inputBasis === 'three'
      ? { ...state, draft: ['', '', '', ''] }
      : { ...state, threeAxisDraft: ['', '', ''] };
  }
}

export function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'edit': {
      if (action.index < 0 || action.index >= state.draft.length || (state.crystalSystem === 'hexagonal' && action.index === 2)) return state;
      const draft = [...state.draft] as IndexDraft | HexIndexDraft;
      draft[action.index] = action.value;
      if (state.crystalSystem === 'hexagonal' && (action.index === 0 || action.index === 1)) {
        draft[2] = dependentHexIndex(draft[0], draft[1]);
      }
      return syncHexDrafts({ ...state, draft, inputBasis: 'four', error: null });
    }
    case 'editThree': {
      if (state.crystalSystem !== 'hexagonal' || !state.threeAxisDraft || action.index < 0 || action.index > 2) return state;
      const threeAxisDraft = [...state.threeAxisDraft] as IndexDraft;
      threeAxisDraft[action.index] = action.value;
      return syncHexDrafts({ ...state, threeAxisDraft, inputBasis: 'three', error: null });
    }
    case 'system':
      return action.crystalSystem === state.crystalSystem ? state : syncHexDrafts({
        ...state,
        crystalSystem: action.crystalSystem,
        draft: defaultDraft(action.crystalSystem),
        threeAxisDraft: null,
        inputBasis: 'four',
        applied: null,
        error: null,
      });
    case 'mode':
      return action.mode === state.mode ? state : syncHexDrafts({ ...state, mode: action.mode, applied: null, error: null });
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
          : createHexagonalDrawing(state.mode, state.inputBasis === 'three'
            ? threeToFourIndices(state.mode, parseIndices(state.threeAxisDraft!))
            : parseHexIndices(state.draft as HexIndexDraft));
        return { ...state, applied, error: null };
      } catch (error) {
        return { ...state, error: error instanceof Error ? error.message : '无法绘制，请检查指数。' };
      }
  }
}
