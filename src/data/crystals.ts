import { latticeGeometry, type CrystalType } from './latticeGeometry';

export type { CrystalType } from './latticeGeometry';
export type ModuleId =
  | 'cell'
  | 'bravais'
  | 'packing'
  | 'coordination'
  | 'density'
  | 'tetra'
  | 'octa'
  | 'carbon';

export type ModelStyle = 'rigid' | 'schematic' | 'ball-stick';

export interface DisplaySettings {
  modelStyle: ModelStyle;
  showCell: boolean;
  showAxes: boolean;
  showLabels: boolean;
  showSupercell: boolean;
  atomOpacity: number;
  speed: number;
  autoRotate: boolean;
  exploded: boolean;
  sectionView: boolean;
}

export interface CrystalInfo {
  type: CrystalType;
  title: string;
  latticeName: string;
  latticeConstant: string;
  radius: string;
  atomsPerCell: string;
  coordination: number;
  apf: number;
  densePlane: string;
  denseDirection: string;
  formula: string;
  formulaDetail: string;
  teaching: string;
  bravais: string;
  packing: string;
  gaps: {
    tetra: string;
    octa: string;
  };
  carbon: string;
}

export interface ModuleItem {
  id: ModuleId;
  index: number;
  title: string;
  summary: string;
}

export const modules: ModuleItem[] = [
  { id: 'cell', index: 1, title: '晶胞模型', summary: '展示基体原子、晶胞框线、坐标轴和模型类型切换。' },
  { id: 'bravais', index: 2, title: '空间点阵', summary: '扩展为 2×2×2 阵列，观察布拉菲点阵平移重复特征。' },
  { id: 'packing', index: 3, title: '密排面 / 密排方向', summary: '高亮典型密排面，并用箭头标示密排方向。' },
  { id: 'coordination', index: 4, title: '配位数', summary: '选择中心原子，按距离高亮最近邻并编号。' },
  { id: 'density', index: 5, title: '致密度', summary: '联动右侧 APF 图表和公式，比较三类典型结构。' },
  { id: 'tetra', index: 6, title: '四面体间隙', summary: '显示四面体间隙位置和围成间隙的基体原子。' },
  { id: 'octa', index: 7, title: '八面体间隙', summary: '显示八面体间隙位置和多面体连接。' },
  { id: 'carbon', index: 8, title: '碳原子嵌入', summary: '点击间隙或使用按钮，把碳原子嵌入优先占据位置。' },
];


export const crystals: Record<CrystalType, CrystalInfo> = {
  FCC: {
    type: 'FCC',
    title: '面心立方结构',
    latticeName: '面心立方点阵',
    latticeConstant: 'a = 1.0000',
    radius: `R = ${latticeGeometry.FCC.atomRadiusOverA.toFixed(4)}a`,
    atomsPerCell: '4',
    coordination: 12,
    apf: 0.74,
    densePlane: '{111}',
    denseDirection: '<110>',
    formula: 'APF = (n × 4/3πR³) / a³ × 100%',
    formulaDetail: '4 × 4/3π(0.3536a)³ / a³ = 74%',
    teaching: 'FCC 的密排面为 {111}，密排方向为 <110>，每个原子周围有 12 个等距离最近邻原子，致密度为 74%，是三种结构中的最高值之一。',
    bravais: '角点和六个面心点共同构成面心立方点阵。2×2×2 阵列能直观看到面心点沿相邻晶胞连续平移。',
    packing: '面心立方的 {111} 面呈三角密排，面内原子沿 <110> 方向相切排列。',
    gaps: {
      tetra: 'FCC 每个晶胞含 8 个四面体间隙，典型坐标为 (1/4,1/4,1/4)。',
      octa: 'FCC 每个晶胞含 4 个八面体间隙，典型坐标为 (1/2,1/2,1/2) 与棱心。',
    },
    carbon: '碳原子在 FCC γ-Fe 中优先进入八面体间隙，因此奥氏体具有较高固溶碳能力。',
  },
  BCC: {
    type: 'BCC',
    title: '体心立方结构',
    latticeName: '体心立方点阵',
    latticeConstant: 'a = 1.0000',
    radius: `R = ${latticeGeometry.BCC.atomRadiusOverA.toFixed(4)}a`,
    atomsPerCell: '2',
    coordination: 8,
    apf: 0.68,
    densePlane: '{110}',
    denseDirection: '<111>',
    formula: 'APF = (2 × 4/3πR³) / a³ × 100%',
    formulaDetail: '2 × 4/3π(0.4330a)³ / a³ = 68%',
    teaching: 'BCC 的原子沿体对角线相切，配位数为 8，致密度约 68%。与 FCC/HCP 相比，间隙形状更扁，碳原子嵌入会带来更明显晶格畸变。',
    bravais: '八个角点加一个体心点构成体心立方点阵，中心点与角点沿体对角线重复。',
    packing: 'BCC 不是密排结构。{110} 是其最密排面（非真正密排面），<111> 是最密方向。',
    gaps: {
      tetra: 'BCC 四面体间隙较多但不规则，碳进入后会引起显著畸变。',
      octa: 'BCC 八面体间隙位于棱心和面心附近，实际有效半径较小。',
    },
    carbon: '碳在 BCC α-Fe 中优先占据八面体间隙（尽管其几何尺寸 r=0.155R 小于四面体 r=0.291R），因为仅需沿 <100> 推开 2 个近邻原子。固溶度低于 FCC 奥氏体。',
  },
  HCP: {
    type: 'HCP',
    title: '密排六方结构',
    latticeName: '六方点阵 + 双原子基元',
    latticeConstant: `a = 1.0000, c/a = ${latticeGeometry.HCP.cOverA.toFixed(3)}`,
    radius: `R = ${latticeGeometry.HCP.atomRadiusOverA.toFixed(4)}a`,
    atomsPerCell: '6',
    coordination: 12,
    apf: 0.74,
    densePlane: '{0001}',
    denseDirection: '<11-20>',
    formula: 'APF = 原子体积 / 六方晶胞体积 × 100%',
    formulaDetail: '理想 HCP c/a = 1.633 时 APF = 74%',
    teaching: 'HCP 与 FCC 都属于密排结构，配位数均为 12，致密度均为 74%。区别在于密排层堆垛方式：HCP 为 ABAB，FCC 为 ABCABC。',
    bravais: 'HCP 可通过六方柱状晶胞理解，底面为密排六角层，中间层错位嵌入。',
    packing: 'HCP 的密排面是基面 {0001}，密排方向在基面内沿 <11-20>。',
    gaps: {
      tetra: 'HCP 的四面体间隙位于上下密排层之间，与 FCC 数量关系类似。',
      octa: 'HCP 的八面体间隙位于两层三角孔垂直对齐处。',
    },
    carbon: 'HCP 金属中的间隙固溶行为取决于 c/a 比、间隙尺寸和局部弹性畸变。',
  },
};

export const apfBars = [
  { type: 'FCC' as const, label: 'FCC', value: 74, color: '#168bff' },
  { type: 'HCP' as const, label: 'HCP', value: 74, color: '#39c36e' },
  { type: 'BCC' as const, label: 'BCC', value: 68, color: '#f28a31' },
];

export const defaultSettings: DisplaySettings = {
  modelStyle: 'schematic',
  showCell: true,
  showAxes: true,
  showLabels: false,
  showSupercell: false,
  atomOpacity: 1,
  speed: 1,
  autoRotate: true,
  exploded: false,
  sectionView: false,
};
