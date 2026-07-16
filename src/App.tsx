import { useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { CrystalCanvas, type CrystalCanvasHandle } from './components/CrystalCanvas';
import { Icon } from './components/Icons';
import { InfoPanel } from './components/InfoPanel';
import { defaultSettings, modules, type CrystalType, type DisplaySettings, type ModuleId } from './data/crystals';
import brandLogo from './assets/brand-logo.png';

export default function App() {
  const [crystal, setCrystal] = useState<CrystalType>('FCC');
  const [activeModule, setActiveModule] = useState<ModuleId>('cell');
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const canvasRef = useRef<CrystalCanvasHandle>(null);

  const activeTitle = useMemo(() => modules.find((item) => item.id === activeModule)?.title ?? '晶胞模型', [activeModule]);

  const handleCrystalChange = (next: CrystalType) => {
    setCrystal(next);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><img src={brandLogo} alt="" /></div>
          <div>
            <h1>材科基 · 晶体结构 3D 可视化实验室</h1>
            <span>Materials Fundamentals Crystal Lab</span>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" onClick={() => canvasRef.current?.resetView()}><Icon name="home" /><span>重置视角</span></button>
          <button className={settings.autoRotate ? 'active' : ''} type="button" onClick={() => setSettings((prev) => ({ ...prev, autoRotate: true }))}><Icon name="rotate" /><span>自动旋转</span></button>
          <button className={!settings.autoRotate ? 'active' : ''} type="button" onClick={() => setSettings((prev) => ({ ...prev, autoRotate: false }))}><Icon name="pause" /><span>暂停动画</span></button>
        </div>
      </header>

      <main className="workspace">
        <ControlPanel
          activeModule={activeModule}
          crystal={crystal}
          settings={settings}
          onCrystalChange={handleCrystalChange}
          onModuleChange={setActiveModule}
          onSettingsChange={setSettings}
        />

        <section className="stage-column">
          <div className="stage-panel">
            <div className="stage-heading">
              <img className="stage-logo" src={brandLogo} alt="" />
              <strong>{activeTitle}</strong>
            </div>
            <CrystalCanvas
              ref={canvasRef}
              crystal={crystal}
              activeModule={activeModule}
              settings={settings}
            />
          </div>
        </section>

        <InfoPanel crystal={crystal} activeModule={activeModule} />
      </main>

    </div>
  );
}
