import { crystals, defaultSettings, modules, type CrystalType, type DisplaySettings, type ModuleId, type ModelStyle } from '../data/crystals';
import { Icon } from './Icons';

interface Props {
  activeModule: ModuleId;
  crystal: CrystalType;
  settings: DisplaySettings;
  onModuleChange: (id: ModuleId) => void;
  onSettingsChange: (settings: DisplaySettings) => void;
}

const moduleIcons: Record<ModuleId, Parameters<typeof Icon>[0]['name']> = {
  cell: 'cube',
  bravais: 'lattice',
  packing: 'plane',
  coordination: 'nodes',
  tetra: 'tetra',
  octa: 'octa',
};

export function ControlPanel({ activeModule, crystal, settings, onModuleChange, onSettingsChange }: Props) {
  const info = crystals[crystal];
  const patch = (partial: Partial<DisplaySettings>) => onSettingsChange({ ...settings, ...partial });
  const setModel = (modelStyle: ModelStyle) => patch({ modelStyle });

  return (
    <aside className="left-rail panel-stack">
      <section className="panel module-panel">
        <div className="panel-heading">
          <span><Icon name="lattice" />功能模块</span>
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
        <div className="panel-heading">
          <span><Icon name="gear" />模型与显示</span>
        </div>
        <div className="display-settings-tab">
          <label className="field-label">当前结构</label>
          <div className="readonly-chip">{info.title}</div>

          <label className="field-label">模型类型</label>
          <div className="segmented compact three" role="group" aria-label="模型类型">
            <button className={settings.modelStyle === 'schematic' ? 'active' : ''} type="button" onClick={() => setModel('schematic')}>参考球模型</button>
            <button className={settings.modelStyle === 'rigid' ? 'active' : ''} type="button" onClick={() => setModel('rigid')}>刚性球模型</button>
            <button className={settings.modelStyle === 'ball-stick' ? 'active' : ''} type="button" onClick={() => setModel('ball-stick')}>球棍模型</button>
          </div>

          <div className="switch-list">
            <Toggle checked={settings.showSupercell} label="显示相邻晶胞（2×2×2）" onChange={(checked) => patch({ showSupercell: checked })} />
          </div>

          <button className="reset-wide" type="button" onClick={() => onSettingsChange(defaultSettings)}>
            <Icon name="reset" />恢复默认设置
          </button>
        </div>

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
