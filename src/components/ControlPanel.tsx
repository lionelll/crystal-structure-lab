import { crystals, defaultSettings, modules, type CrystalType, type DisplaySettings, type ModuleId, type ModelStyle } from '../data/crystals';
import { Icon } from './Icons';

interface Props {
  activeModule: ModuleId;
  crystal: CrystalType;
  settings: DisplaySettings;
  carbonInserted: boolean;
  onModuleChange: (id: ModuleId) => void;
  onSettingsChange: (settings: DisplaySettings) => void;
  onCarbonChange: (value: boolean) => void;
}

const moduleIcons: Record<ModuleId, Parameters<typeof Icon>[0]['name']> = {
  cell: 'cube',
  bravais: 'lattice',
  packing: 'plane',
  coordination: 'nodes',
  density: 'density',
  tetra: 'tetra',
  octa: 'octa',
  carbon: 'carbon',
};

export function ControlPanel({ activeModule, crystal, settings, carbonInserted, onModuleChange, onSettingsChange, onCarbonChange }: Props) {
  const info = crystals[crystal];
  const patch = (partial: Partial<DisplaySettings>) => onSettingsChange({ ...settings, ...partial });
  const setModel = (modelStyle: ModelStyle) => patch({ modelStyle });

  return (
    <aside className="left-rail panel-stack">
      <section className="panel module-panel">
        <div className="panel-tabs" role="tablist" aria-label="左侧设置">
          <button className="panel-tab active" type="button"><Icon name="lattice" />功能模块</button>
          <button className="panel-tab" type="button"><Icon name="gear" />显示设置</button>
        </div>
        <div className="module-list">
          {modules.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`module-row ${activeModule === item.id ? 'active' : ''}`}
              onClick={() => onModuleChange(item.id)}
              title={item.summary}
            >
              <Icon name={moduleIcons[item.id]} />
              <span className="module-index">{item.index}</span>
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel controls-panel">
        <div className="panel-heading">模型与显示</div>
        <label className="field-label">当前结构</label>
        <div className="readonly-chip">{info.title}</div>

        <label className="field-label">模型类型</label>
        <div className="segmented compact" role="group" aria-label="模型类型">
          <button className={settings.modelStyle === 'rigid' ? 'active' : ''} type="button" onClick={() => setModel('rigid')}>刚性球模型</button>
          <button className={settings.modelStyle === 'ball-stick' ? 'active' : ''} type="button" onClick={() => setModel('ball-stick')}>球棍模型</button>
        </div>

        <div className="switch-list">
          <Toggle checked={settings.showCell} label="显示晶胞框线" onChange={(checked) => patch({ showCell: checked })} />
          <Toggle checked={settings.showAxes} label="显示坐标轴" onChange={(checked) => patch({ showAxes: checked })} />
          <Toggle checked={settings.showLabels} label="显示原子编号" onChange={(checked) => patch({ showLabels: checked })} />
          <Toggle checked={settings.showSupercell} label="显示相邻晶胞（2×2×2）" onChange={(checked) => patch({ showSupercell: checked })} />
        </div>

        <label className="range-row">
          <span>原子透明度</span>
          <input type="range" min="35" max="100" value={Math.round(settings.atomOpacity * 100)} onChange={(event) => patch({ atomOpacity: Number(event.target.value) / 100 })} />
          <b>{Math.round(settings.atomOpacity * 100)}%</b>
        </label>
        <label className="range-row">
          <span>动画速度</span>
          <input type="range" min="0" max="200" value={Math.round(settings.speed * 100)} onChange={(event) => patch({ speed: Number(event.target.value) / 100 })} />
          <b>{settings.speed.toFixed(1)}x</b>
        </label>

        {activeModule === 'carbon' && (
          <div className="carbon-box">
            <div>
              <strong>碳原子状态</strong>
              <p>{carbonInserted ? '已进入目标间隙，可对比 FCC / BCC 间隙差异。' : '等待嵌入。点击画布中的发光间隙或下方按钮。'}</p>
            </div>
            <button className="primary-action" type="button" onClick={() => onCarbonChange(!carbonInserted)}>
              {carbonInserted ? '移出碳原子' : '放入八面体间隙'}
            </button>
          </div>
        )}

        <button className="reset-wide" type="button" onClick={() => onSettingsChange(defaultSettings)}>
          <Icon name="reset" />恢复默认设置
        </button>
      </section>
    </aside>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="fake-check" />
      <span>{label}</span>
    </label>
  );
}
