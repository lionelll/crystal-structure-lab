import { useMemo, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { CrystalCanvas, type CrystalCanvasHandle } from './components/CrystalCanvas';
import { Icon } from './components/Icons';
import { InfoPanel } from './components/InfoPanel';
import { crystals, defaultSettings, modules, type CrystalType, type DisplaySettings, type ModuleId } from './data/crystals';

export default function App() {
  const [crystal, setCrystal] = useState<CrystalType>('FCC');
  const [activeModule, setActiveModule] = useState<ModuleId>('cell');
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [helpOpen, setHelpOpen] = useState(false);
  const canvasRef = useRef<CrystalCanvasHandle>(null);

  const activeTitle = useMemo(() => modules.find((item) => item.id === activeModule)?.title ?? '晶胞模型', [activeModule]);

  const handleCrystalChange = (next: CrystalType) => {
    setCrystal(next);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Icon name="cube" /></div>
          <div>
            <h1>材科基 · 晶体结构 3D 可视化实验室</h1>
            <span>Materials Fundamentals Crystal Lab</span>
          </div>
        </div>

        <nav className="crystal-tabs" aria-label="晶体结构切换">
          {(['FCC', 'BCC', 'HCP'] as CrystalType[]).map((type) => (
            <button key={type} type="button" className={crystal === type ? 'active' : ''} onClick={() => handleCrystalChange(type)}>
              {type}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          <button type="button" onClick={() => canvasRef.current?.resetView()}><Icon name="reset" /><span>重置</span></button>
          <button type="button" onClick={toggleFullscreen}><Icon name="fullscreen" /><span>全屏</span></button>
          <button type="button" onClick={() => setHelpOpen(true)}><Icon name="help" /><span>帮助</span></button>
          <button type="button" onClick={() => canvasRef.current?.capture()}><Icon name="camera" /><span>截图</span></button>
        </div>
      </header>

      <main className="workspace">
        <ControlPanel
          activeModule={activeModule}
          crystal={crystal}
          settings={settings}
          onModuleChange={setActiveModule}
          onSettingsChange={setSettings}
        />

        <section className="stage-column">
          <div className="stage-panel">
            <CrystalCanvas
              ref={canvasRef}
              crystal={crystal}
              activeModule={activeModule}
              settings={settings}
            />
          </div>

          <div className="tool-dock" aria-label="底部工具栏">
            <ActionTile icon="home" label="重置视角" onClick={() => canvasRef.current?.resetView()} />
            <ActionTile icon="explode" label={settings.exploded ? '收回拆解' : '爆炸拆解'} onClick={() => setSettings((prev) => ({ ...prev, exploded: !prev.exploded }))} />
            <ActionTile icon="section" label={settings.sectionView ? '关闭截面' : '截面查看'} onClick={() => setSettings((prev) => ({ ...prev, sectionView: !prev.sectionView }))} />
            <ActionTile icon="rotate" label="自动旋转" active={settings.autoRotate} onClick={() => setSettings((prev) => ({ ...prev, autoRotate: !prev.autoRotate }))} />
            <ActionTile icon="pause" label="暂停动画" onClick={() => setSettings((prev) => ({ ...prev, autoRotate: false }))} />
            <ActionTile icon="camera" label="截图保存" onClick={() => canvasRef.current?.capture()} />
          </div>
        </section>

        <InfoPanel crystal={crystal} activeModule={activeModule} />
      </main>

      <footer className="status-strip">
        <span>当前模块：{activeTitle}</span>
        <span>结构：{crystals[crystal].title}</span>
        <span>本地 WebGL 渲染 · 无后端依赖</span>
      </footer>

      {helpOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setHelpOpen(false)}>
          <div className="help-modal panel" role="dialog" aria-modal="true" aria-label="帮助" onClick={(event) => event.stopPropagation()}>
            <div className="card-title">操作帮助</div>
            <p>拖拽旋转晶体，滚轮缩放，右键平移。左侧选择功能模块，顶部切换 FCC / BCC / HCP，底部工具栏控制拆解、截面、旋转和截图。</p>
            <button className="primary-action" type="button" onClick={() => setHelpOpen(false)}>知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionTile({ icon, label, active = false, onClick }: { icon: Parameters<typeof Icon>[0]['name']; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button className={`tool-tile ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}
