import { useState, type Dispatch } from 'react';
import type { DrawingAction, DrawingState } from '../core/drawingState';
import { Icon } from './Icons';
import './drawing.css';

export function DrawingControls({ state, dispatch }: { state: DrawingState; dispatch: Dispatch<DrawingAction> }) {
  const [expanded, setExpanded] = useState(true);
  const names = state.mode === 'plane' ? ['h', 'k', 'l'] : ['u', 'v', 'w'];
  return (
    <section className={`drawing-controls ${expanded ? 'is-expanded' : ''}`} aria-label="晶面晶向绘制参数">
      <button type="button" className="drawing-controls-heading" aria-expanded={expanded} aria-controls="drawing-form" onClick={() => setExpanded(!expanded)}>
        <span>绘制参数</span><Icon name="chevron" />
      </button>
      <form id="drawing-form" hidden={!expanded} onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'draw' }); }}>
        <fieldset className="drawing-modes">
          <legend className="visually-hidden">绘制类型</legend>
          {(['plane', 'direction'] as const).map((mode) => (
            <label key={mode} className={state.mode === mode ? 'selected' : ''}>
              <input type="radio" name="drawing-mode" value={mode} checked={state.mode === mode} onChange={() => dispatch({ type: 'mode', mode })} />
              <span>{mode === 'plane' ? '晶面 (hkl)' : '晶向 [uvw]'}</span>
            </label>
          ))}
        </fieldset>
        <div className="drawing-indices">
          {names.map((name, index) => (
            <label key={index}>
              <span>{name}</span>
              <input aria-label={`${name} 指数`} type="text" inputMode="text" autoComplete="off" spellCheck={false}
                value={state.draft[index]} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? 'drawing-error' : undefined}
                onChange={(event) => dispatch({ type: 'edit', index, value: event.currentTarget.value })} />
            </label>
          ))}
        </div>
        <div className="drawing-commands">
          <button type="submit" className="draw-command"><Icon name="plane" />绘制</button>
          <button type="button" onClick={() => dispatch({ type: 'clear' })}><Icon name="reset" />清除</button>
        </div>
        {state.error && <p id="drawing-error" className="drawing-error" role="alert">{state.error}</p>}
      </form>
    </section>
  );
}
