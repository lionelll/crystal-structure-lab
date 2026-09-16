import { useState, type Dispatch } from 'react';
import type { DrawingAction, DrawingState } from '../core/drawingState';
import { Icon } from './Icons';
import './drawing.css';

export function DrawingControls({ state, dispatch }: { state: DrawingState; dispatch: Dispatch<DrawingAction> }) {
  const [expanded, setExpanded] = useState(true);
  const hexagonal = state.crystalSystem === 'hexagonal';
  const threeNames = state.mode === 'plane' ? ['h', 'k', 'l'] : ['U', 'V', 'W'];
  const names = state.crystalSystem === 'cubic'
    ? (state.mode === 'plane' ? ['h', 'k', 'l'] : ['u', 'v', 'w'])
    : (state.mode === 'plane' ? ['h', 'k', 'i', 'l'] : ['u', 'v', 't', 'w']);
  return (
    <section className={`drawing-controls ${expanded ? 'is-expanded' : ''} ${hexagonal ? 'is-hexagonal' : ''}`} aria-label="晶面晶向绘制参数">
      <button type="button" className="drawing-controls-heading" aria-expanded={expanded} aria-controls="drawing-form" onClick={() => setExpanded(!expanded)}>
        <span>绘制参数</span><Icon name="chevron" />
      </button>
      <form id="drawing-form" hidden={!expanded} onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'draw' }); }}>
        <fieldset className="drawing-systems">
          <legend className="visually-hidden">晶系</legend>
          {(['cubic', 'hexagonal'] as const).map((crystalSystem) => (
            <label key={crystalSystem} className={state.crystalSystem === crystalSystem ? 'selected' : ''}>
              <input type="radio" name="drawing-system" value={crystalSystem} checked={state.crystalSystem === crystalSystem}
                onChange={() => dispatch({ type: 'system', crystalSystem })} />
              <span>{crystalSystem === 'cubic' ? '立方晶系' : '六方晶系'}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="drawing-modes">
          <legend className="visually-hidden">绘制类型</legend>
          {(['plane', 'direction'] as const).map((mode) => (
            <label key={mode} className={state.mode === mode ? 'selected' : ''}>
              <input type="radio" name="drawing-mode" value={mode} checked={state.mode === mode} onChange={() => dispatch({ type: 'mode', mode })} />
              <span>{mode === 'plane'
                ? `晶面 ${state.crystalSystem === 'cubic' ? '(hkl)' : '(hkil)'}`
                : `晶向 ${state.crystalSystem === 'cubic' ? '[uvw]' : '[uvtw]'}`}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="drawing-index-group">
          {hexagonal && <legend>四轴指数 {state.mode === 'plane' ? '(hkil)' : '[uvtw]'}</legend>}
          <div className={`drawing-indices ${hexagonal ? 'is-hexagonal' : ''}`}>
            {names.map((name, index) => (
              <label key={index}>
                <span>{name}</span>
                <input aria-label={`${name} 指数`} type="text" inputMode="text" autoComplete="off" spellCheck={false}
                  value={state.draft[index]} aria-invalid={Boolean(state.error) && (!hexagonal || state.inputBasis === 'four')} aria-describedby={state.error ? 'drawing-error' : undefined}
                  readOnly={hexagonal && index === 2}
                  onChange={(event) => dispatch({ type: 'edit', index, value: event.currentTarget.value })} />
              </label>
            ))}
          </div>
          {hexagonal && <p className="drawing-constraint">{state.mode === 'plane' ? 'i = -(h + k)' : 't = -(u + v)'}</p>}
        </fieldset>
        {hexagonal && <fieldset className="drawing-index-group drawing-three-axis">
          <legend>三轴指数 {state.mode === 'plane' ? '(hkl)' : '[UVW]'}</legend>
          <div className="drawing-indices">
            {threeNames.map((name, index) => (
              <label key={name}>
                <span>{name}</span>
                <input aria-label={`三轴 ${name} 指数`} type="text" inputMode="text" autoComplete="off" spellCheck={false}
                  value={state.threeAxisDraft?.[index] ?? ''} aria-invalid={Boolean(state.error) && state.inputBasis === 'three'}
                  aria-describedby={state.error ? 'drawing-error' : undefined}
                  onChange={(event) => dispatch({ type: 'editThree', index, value: event.currentTarget.value })} />
              </label>
            ))}
          </div>
        </fieldset>}
        <div className="drawing-commands">
          <button type="submit" className="draw-command"><Icon name="plane" />绘制</button>
          <button type="button" onClick={() => dispatch({ type: 'clear' })}><Icon name="reset" />清除</button>
        </div>
        {state.error && <p id="drawing-error" className="drawing-error" role="alert">{state.error}</p>}
      </form>
    </section>
  );
}
