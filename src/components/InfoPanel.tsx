import { useState } from 'react';
import { crystals, modules, type CrystalType, type ModuleId } from '../data/crystals';

interface Props {
  crystal: CrystalType;
  activeModule: ModuleId;
}

const moduleDetails: Record<ModuleId, (type: CrystalType) => string> = {
  cell: (type) => `${type} 基础晶胞显示角点、中心或面心原子，并保留晶胞框线、坐标轴和原子编号。`,
  bravais: () => '空间点阵由当前晶体类型派生并独立显示；开启相邻晶胞后可观察三维周期重复。',
  packing: (type) => crystals[type].packing,
  coordination: (type) => `${type} 的配位数为 ${crystals[type].coordination}。黄色中心原子周围的红色编号原子为最近邻。`,
  tetra: (type) => crystals[type].gaps.tetra,
  octa: (type) => crystals[type].gaps.octa,
};

export function InfoPanel({ crystal, activeModule }: Props) {
  const info = crystals[crystal];
  const module = modules.find((item) => item.id === activeModule)!;
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
          <dt>{crystal === 'BCC' ? '最密排面' : '密排面'}</dt><dd>{info.densePlane}</dd>
          <dt>{crystal === 'BCC' ? '最密方向' : '密排方向'}</dt><dd>{info.denseDirection}</dd>
        </dl>
        )}
      </section>

      <section className={`panel teaching-card ${collapsed.teaching ? 'collapsed' : ''}`}>
        <CardTitle title="教学解析" collapsed={collapsed.teaching} onToggle={() => toggle('teaching')} />
        {!collapsed.teaching && (
        <>
        <p>{moduleDetails[activeModule](crystal)}</p>
        <p className="module-note"><strong>{module.index} {module.title}</strong>：{module.summary}</p>
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
