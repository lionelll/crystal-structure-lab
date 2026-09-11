import { useMemo, useReducer, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary';
import { CrystalCanvas, type CrystalCanvasHandle } from './components/CrystalCanvas';
import { IonicCrystalCanvas } from './components/IonicCrystalCanvas';
import { Icon } from './components/Icons';
import { InfoPanel } from './components/InfoPanel';
import { DrawingControls } from './components/DrawingControls';
import { drawingReducer, initialDrawingState } from './core/drawingState';
import {
  defaultSettings,
  isCrystalType,
  modules,
  resolveCrystal,
  type CrystalType,
  type DisplaySettings,
  type ModuleId,
} from './data/crystals';
import {
  ionicDefaultSupercell,
  ionicModules,
  isIonicCrystalId,
  resolveIonicCrystal,
  type CrystalFamily,
  type IonicCrystalId,
  type IonicModuleId,
} from './data/ionicCrystals';
import brandLogo from './assets/brand-logo.png';

export default function App() {
  const [family, setFamily] = useState<CrystalFamily>('metal');
  const [crystal, setCrystal] = useState<CrystalType>('FCC');
  const [activeModule, setActiveModule] = useState<ModuleId>('cell');
  const [ionicCrystal, setIonicCrystal] = useState<IonicCrystalId>('cscl');
  const [ionicModule, setIonicModule] = useState<IonicModuleId>('cell');
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [drawingState, dispatchDrawing] = useReducer(drawingReducer, undefined, initialDrawingState);
  const drawingActive = family === 'metal' && activeModule === 'drawing';
  const effectiveSettings = drawingActive ? { ...settings, showSupercell: false, autoRotate: drawingState.autoRotate } : settings;
  const setAutoRotate = (value: boolean) => {
    if (drawingActive) dispatchDrawing({ type: 'rotate', value });
    else setSettings((current) => ({ ...current, autoRotate: value }));
  };
  const canvasRef = useRef<CrystalCanvasHandle>(null);
  const resolvedCrystal = resolveCrystal(crystal);
  const resolvedIonicCrystal = resolveIonicCrystal(ionicCrystal);

  const activeTitle = useMemo(() => {
    const source = family === 'metal' ? modules : ionicModules;
    const id = family === 'metal' ? activeModule : ionicModule;
    return source.find((item) => item.id === id)?.title ?? '晶胞模型';
  }, [activeModule, family, ionicModule]);

  const handleCrystalChange = (next: CrystalType) => {
    if (!isCrystalType(next)) return;
    if (next !== crystal) dispatchDrawing({ type: 'reset' });
    if (next === 'HCP' && activeModule === 'drawing') setActiveModule('cell');
    setCrystal(next);
  };

  const handleFamilyChange = (next: CrystalFamily) => {
    if (next !== family) dispatchDrawing({ type: 'reset' });
    setFamily(next);
    setSettings((current) => ({
      ...current,
      showSupercell: next === 'ionic' && ionicDefaultSupercell(resolvedIonicCrystal.id),
    }));
  };

  const handleIonicCrystalChange = (next: IonicCrystalId) => {
    if (!isIonicCrystalId(next)) return;
    setIonicCrystal(next);
    setSettings((current) => ({ ...current, showSupercell: ionicDefaultSupercell(next) }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><img src={brandLogo} alt="" /></div>
          <div>
            <h1>材科基 · 晶体结构 3D 可视化实验室</h1>
            <span>畅研材料考研交流群：692990403</span>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" onClick={() => canvasRef.current?.resetView()}><Icon name="home" /><span>重置视角</span></button>
          <button className={effectiveSettings.autoRotate ? 'active' : ''} type="button" onClick={() => setAutoRotate(true)}><Icon name="rotate" /><span>自动旋转</span></button>
          <button className={!effectiveSettings.autoRotate ? 'active' : ''} type="button" onClick={() => setAutoRotate(false)}><Icon name="pause" /><span>暂停动画</span></button>
        </div>
      </header>

      <main className="workspace">
        <ControlPanel
          family={family}
          activeModule={family === 'metal' ? activeModule : ionicModule}
          crystal={resolvedCrystal.type}
          ionicCrystal={resolvedIonicCrystal.id}
          settings={settings}
          onFamilyChange={handleFamilyChange}
          onCrystalChange={handleCrystalChange}
          onIonicCrystalChange={handleIonicCrystalChange}
          onModuleChange={(id) => {
            if (family === 'metal') {
              if (id === 'drawing' && crystal === 'HCP') return;
              if (id !== activeModule) dispatchDrawing({ type: 'reset' });
              setActiveModule(id as ModuleId);
            }
            else setIonicModule(id as IonicModuleId);
          }}
          onSettingsChange={setSettings}
        />

        <section className="stage-column">
          <div className="stage-panel">
            <div className="stage-heading">
              <img className="stage-logo" src={brandLogo} alt="" />
              <strong>{activeTitle}</strong>
            </div>
            <CanvasErrorBoundary
              resetKey={`${family}:${family === 'metal' ? resolvedCrystal.type : resolvedIonicCrystal.id}:${family === 'metal' ? activeModule : ionicModule}`}
            >
              {family === 'metal' ? (
                <CrystalCanvas
                  ref={canvasRef}
                  crystal={resolvedCrystal.type}
                  activeModule={activeModule}
                  settings={effectiveSettings}
                  drawing={drawingState.applied}
                />
              ) : (
                <IonicCrystalCanvas
                  ref={canvasRef}
                  crystalId={resolvedIonicCrystal.id}
                  activeModule={ionicModule}
                  settings={settings}
                />
              )}
            </CanvasErrorBoundary>
            {drawingActive && <DrawingControls key={crystal} state={drawingState} dispatch={dispatchDrawing} />}
          </div>
        </section>

        <InfoPanel
          family={family}
          crystal={resolvedCrystal.type}
          activeModule={activeModule}
          ionicCrystal={resolvedIonicCrystal}
          ionicModule={ionicModule}
          drawingState={drawingState}
        />
      </main>

    </div>
  );
}
