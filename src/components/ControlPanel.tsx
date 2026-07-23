import { useState } from 'react';
import { isCrystalType, modules, type CrystalType, type DisplaySettings, type ModuleId } from '../data/crystals';
import {
  ionicCrystalOrder,
  ionicCrystals,
  ionicModules,
  isIonicCrystalId,
  type CrystalFamily,
  type IonicCrystalId,
  type IonicModuleId,
} from '../data/ionicCrystals';
import { Icon } from './Icons';

interface Props {
  family: CrystalFamily;
  activeModule: ModuleId | IonicModuleId;
  crystal: CrystalType;
  ionicCrystal: IonicCrystalId;
  settings: DisplaySettings;
  onFamilyChange: (family: CrystalFamily) => void;
  onCrystalChange: (type: CrystalType) => void;
  onIonicCrystalChange: (id: IonicCrystalId) => void;
  onModuleChange: (id: ModuleId | IonicModuleId) => void;
  onSettingsChange: (settings: DisplaySettings) => void;
}

const moduleIcons: Record<ModuleId | IonicModuleId, Parameters<typeof Icon>[0]['name']> = {
  cell: 'cube',
  stacking: 'layers',
  bravais: 'lattice',
  packing: 'plane',
  coordination: 'nodes',
  tetra: 'tetra',
  octa: 'octa',
  'ion-sites': 'nodes',
};

const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;
const defaultPanelExpanded = () => !isMobileViewport();

export function ControlPanel({
  family,
  activeModule,
  crystal,
  ionicCrystal,
  settings,
  onFamilyChange,
  onCrystalChange,
  onIonicCrystalChange,
  onModuleChange,
  onSettingsChange,
}: Props) {
  const patch = (partial: Partial<DisplaySettings>) => onSettingsChange({ ...settings, ...partial });
  const activeModules = family === 'metal' ? modules : ionicModules;
  const [crystalSelectionExpanded, setCrystalSelectionExpanded] = useState(defaultPanelExpanded);
  const [modulesExpanded, setModulesExpanded] = useState(defaultPanelExpanded);
  const collapseOnMobile = (collapse: () => void) => {
    if (isMobileViewport()) collapse();
  };

  return (
    <aside className="left-rail panel-stack">
      <section className={`panel crystal-selection-panel mobile-collapsible ${crystalSelectionExpanded ? 'is-expanded' : 'is-collapsed'}`}>
        <button
          type="button"
          className="panel-heading panel-heading-button crystal-selection-heading"
          aria-expanded={crystalSelectionExpanded}
          aria-controls="crystal-selection-content"
          onClick={() => {
            if (isMobileViewport()) setCrystalSelectionExpanded((current) => !current);
          }}
        >
          <span>晶体选择</span>
          <Icon className="collapse-chevron" name="chevron" />
        </button>
        <div className="collapsible-content" id="crystal-selection-content">
          <div className="crystal-family-list">
            <div className={`crystal-family-card ${family === 'metal' ? 'active' : ''}`}>
              <button type="button" className="crystal-family-button" onClick={() => onFamilyChange('metal')}>
                <Icon name="cube" />
                <span>纯金属的晶体结构</span>
              </button>
              {family === 'metal' && (
                <select
                  value={crystal}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    if (isCrystalType(value)) {
                      onCrystalChange(value);
                      collapseOnMobile(() => setCrystalSelectionExpanded(false));
                    }
                  }}
                  aria-label="纯金属的晶体结构"
                >
                  <option value="FCC">FCC</option>
                  <option value="BCC">BCC</option>
                  <option value="HCP">HCP</option>
                </select>
              )}
            </div>

            <div className={`crystal-family-card ionic ${family === 'ionic' ? 'active' : ''}`}>
              <button type="button" className="crystal-family-button" onClick={() => onFamilyChange('ionic')}>
                <Icon name="lattice" />
                <span>离子晶体结构</span>
              </button>
              {family === 'ionic' && (
                <select
                  className="ionic-structure-select"
                  value={ionicCrystal}
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    if (isIonicCrystalId(value)) {
                      onIonicCrystalChange(value);
                      collapseOnMobile(() => setCrystalSelectionExpanded(false));
                    }
                  }}
                  aria-label="离子晶体结构"
                >
                  {ionicCrystalOrder.map((id) => <option key={id} value={id}>{ionicCrystals[id].title}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`panel module-panel mobile-collapsible ${modulesExpanded ? 'is-expanded' : 'is-collapsed'}`}>
        <button
          type="button"
          className="panel-heading panel-heading-button"
          aria-expanded={modulesExpanded}
          aria-controls="module-list-content"
          onClick={() => {
            if (isMobileViewport()) setModulesExpanded((current) => !current);
          }}
        >
          <span>功能模块</span>
          <Icon className="collapse-chevron" name="chevron" />
        </button>
        <div className="collapsible-content" id="module-list-content">
          <div className="module-list">
            {activeModules.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`module-row ${activeModule === item.id ? 'active' : ''}`}
                onClick={() => {
                  onModuleChange(item.id);
                  collapseOnMobile(() => setModulesExpanded(false));
                }}
                title={item.summary}
              >
                <Icon name={moduleIcons[item.id]} />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel controls-panel">
        <div className="panel-heading">
          <span>模型显示</span>
        </div>
        <div className="display-settings-tab">
          <div className="switch-list">
            <Toggle disabled={family === 'metal' && activeModule === 'stacking'} checked={settings.showSupercell} label="显示相邻晶胞（2×2×2）" onChange={(checked) => patch({ showSupercell: checked })} />
          </div>
        </div>
      </section>
    </aside>
  );
}

function Toggle({ checked, disabled = false, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" disabled={disabled} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="fake-check" />
      <span>{label}</span>
    </label>
  );
}
