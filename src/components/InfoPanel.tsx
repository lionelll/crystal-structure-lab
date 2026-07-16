import { crystals, type CrystalType, type ModuleId } from '../data/crystals';

interface Props {
  crystal: CrystalType;
  activeModule: ModuleId;
}

const moduleDetails: Record<ModuleId, (type: CrystalType) => string> = {
  cell: (type) => `${type} 基础晶胞显示角点、中心或面心原子，并保留晶胞框线和晶系坐标轴。`,
  stacking: (type) => crystals[type].stacking,
  bravais: () => '空间点阵由当前晶体类型派生并独立显示；开启相邻晶胞后可观察三维周期重复。',
  packing: (type) => crystals[type].packing,
  coordination: (type) => `${type} 的配位数为 ${crystals[type].coordination}。黄色中心原子周围的红色原子为最近邻。`,
  tetra: (type) => crystals[type].gaps.tetra,
  octa: (type) => crystals[type].gaps.octa,
};

export function InfoPanel({ crystal, activeModule }: Props) {
  const info = crystals[crystal];
  const structureName = info.title.replace('结构', '');
  const typicalMetals: Record<CrystalType, string> = {
    FCC: 'Cu、Al、Au、Ag',
    BCC: 'α-Fe、W、Mo、Cr',
    HCP: 'Mg、Zn、α-Ti、Be',
  };

  return (
    <aside className="right-rail panel-stack">
      <section className="panel info-card">
        <div className="card-title">当前信息</div>
        <dl className="info-grid">
          <dt>结构类型：</dt><dd>{info.type}（{structureName}）</dd>
          <dt>配位数（CN）：</dt><dd>{info.coordination}</dd>
          <dt>晶胞参数（a）：</dt><dd>{info.latticeConstant}</dd>
          <dt>原子半径（R）：</dt><dd>{info.radius}</dd>
          <dt>晶胞原子数：</dt><dd>{info.atomsPerCell}</dd>
          <dt>典型金属：</dt><dd>{typicalMetals[crystal]}</dd>
        </dl>
      </section>

      <section className="panel teaching-card">
        <div className="card-title">教学解析</div>
        <p>{activeModule === 'cell' ? info.teaching : moduleDetails[activeModule](crystal)}</p>
      </section>
    </aside>
  );
}
