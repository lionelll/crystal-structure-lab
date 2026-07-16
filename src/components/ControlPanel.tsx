import { modules, type CrystalType, type DisplaySettings, type ModuleId } from '../data/crystals';
import { Icon } from './Icons';

interface Props {
  activeModule: ModuleId;
  crystal: CrystalType;
  settings: DisplaySettings;
  onCrystalChange: (type: CrystalType) => void;
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

export function ControlPanel({ activeModule, crystal, settings, onCrystalChange, onModuleChange, onSettingsChange }: Props) {
  const patch = (partial: Partial<DisplaySettings>) => onSettingsChange({ ...settings, ...partial });

  return (
    <aside className="left-rail panel-stack">
      <section className="panel crystal-selection-panel">
        <div className="panel-heading crystal-selection-heading">
          <span>晶体选择</span>
          <Icon name="help" />
        </div>
        <label className="crystal-picker">
          <Icon name="cube" />
          <span className="module-index">1</span>
          <span className="crystal-picker-copy">
            <small>纯金属的晶体结构</small>
            <select value={crystal} onChange={(event) => onCrystalChange(event.target.value as CrystalType)} aria-label="纯金属的晶体结构">
              <option value="FCC">FCC</option>
              <option value="BCC">BCC</option>
              <option value="HCP">HCP</option>
            </select>
          </span>
        </label>
      </section>

      <section className="panel module-panel">
        <div className="panel-heading">
          <span>功能模块</span>
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
          <span>模型显示</span>
        </div>
        <div className="display-settings-tab">
          <div className="switch-list">
            <Toggle checked={settings.showSupercell} label="显示相邻晶胞（2×2×2）" onChange={(checked) => patch({ showSupercell: checked })} />
          </div>
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
