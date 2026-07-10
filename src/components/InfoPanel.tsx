import { useState } from 'react';
import { apfBars, crystals, modules, type CrystalType, type ModuleId } from '../data/crystals';

interface Props {
  crystal: CrystalType;
  activeModule: ModuleId;
  carbonInserted: boolean;
}

const moduleDetails: Record<ModuleId, (type: CrystalType) => string> = {
  cell: (type) => `${type} 基础晶胞显示角点、中心或面心原子，并保留晶胞框线、坐标轴和原子编号。`,
  bravais: () => '空间点阵模式展示 2×2×2 平移阵列，用于观察晶格点在三维空间中的周期重复。',
  packing: (type) => crystals[type].packing,
  coordination: (type) => `${type} 的配位数为 ${crystals[type].coordination}。黄色中心原子周围被编号的原子为最近邻。`,
  density: (type) => `${type} 的致密度 APF 为 ${Math.round(crystals[type].apf * 100)}%，右侧柱状图同步比较 FCC、HCP 与 BCC。`,
  tetra: (type) => crystals[type].gaps.tetra,
  octa: (type) => crystals[type].gaps.octa,
  carbon: (type) => crystals[type].carbon,
};

export function InfoPanel({ crystal, activeModule, carbonInserted }: Props) {
  const info = crystals[crystal];
  const module = modules.find((item) => item.id === activeModule)!;
  const maxBar = 100;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed((current) => ({ ...current, [id]: !current[id] }));

  return (
    <aside className="right-rail panel-stack">
      <section className={`panel info-card ${collapsed.info ? 'collapsed' : ''}`}>
        <CardTitle title="当前信息" collapsed={collapsed.info} onToggle={() => toggle('info')} />
        {!collapsed.info && (
        <dl className="info-grid">
          <dt>结构类型</dt><dd><span className="type-pill">{info.type}</span><span>{info.latticeName}</span></dd>
          <dt>晶格常数</dt><dd>{info.latticeConstant}</dd>
          <dt>原子半径</dt><dd>{info.radius}</dd>
          <dt>晶胞内原子数</dt><dd>{info.atomsPerCell}</dd>
          <dt>配位数</dt><dd>{info.coordination}</dd>
          <dt>致密度（APF）</dt><dd>{info.apf.toFixed(2)}（{Math.round(info.apf * 100)}%）</dd>
          <dt>{crystal === 'BCC' ? '最密排面' : '密排面'}</dt><dd>{info.densePlane}</dd>
          <dt>{crystal === 'BCC' ? '最密方向' : '密排方向'}</dt><dd>{info.denseDirection}</dd>
        </dl>
        )}
      </section>

      <section className={`panel chart-card ${collapsed.chart ? 'collapsed' : ''}`}>
        <CardTitle title="致密度（APF）对比" collapsed={collapsed.chart} onToggle={() => toggle('chart')} />
        {!collapsed.chart && (
        <>
        <div className="chart-label">APF (%)</div>
        <div className="bar-chart" aria-label="APF 对比柱状图">
          <div className="axis-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
          <div className="bars">
            {apfBars.map((bar) => (
              <div className={`bar-wrap ${bar.type === crystal ? 'selected' : ''}`} key={bar.type}>
                <span className="bar-value">{bar.value}%</span>
                <div className="bar" style={{ height: `${(bar.value / maxBar) * 100}%`, background: bar.color }} />
                <span className="bar-name">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </section>

      <section className={`panel formula-card ${collapsed.formula ? 'collapsed' : ''}`}>
        <CardTitle title="公式与计算" collapsed={collapsed.formula} onToggle={() => toggle('formula')} />
        {!collapsed.formula && (
        <>
        <div className="formula-main">{info.formula}</div>
        <div className="formula-detail">= {info.formulaDetail}</div>
        </>
        )}
      </section>

      <section className={`panel teaching-card ${collapsed.teaching ? 'collapsed' : ''}`}>
        <CardTitle title="教学解析" collapsed={collapsed.teaching} onToggle={() => toggle('teaching')} />
        {!collapsed.teaching && (
        <>
        <p>{moduleDetails[activeModule](crystal)}</p>
        <p className="module-note"><strong>{module.index} {module.title}</strong>：{module.summary}</p>
        {activeModule === 'carbon' && (
          <p className="carbon-state">当前碳原子：{carbonInserted ? '已嵌入间隙' : '位于晶胞外，等待嵌入'}</p>
        )}
        </>
        )}
      </section>
    </aside>
  );
}

function CardTitle({ title, collapsed, onToggle }: { title: string; collapsed?: boolean; onToggle: () => void }) {
  return (
    <button className="card-title card-title-button" type="button" onClick={onToggle} aria-expanded={!collapsed}>
      <span>{title}</span>
      <span aria-hidden="true">{collapsed ? '›' : '⌄'}</span>
    </button>
  );
}
