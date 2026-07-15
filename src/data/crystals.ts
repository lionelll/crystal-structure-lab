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

export interface ModuleSpec {
  goal: string;
  interaction: string;
  logic: string;
  visual: string;
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


export const moduleSpecs: Record<ModuleId, ModuleSpec> = {
  cell: {
    goal: '建立 FCC / BCC / HCP 的基础晶胞空间概念。',
    interaction: '切换参考球模型、刚性球模型与球棍模型，显示或隐藏晶胞框线、坐标轴和原子编号。',
    logic: '以 a = 1.0 为统一晶胞尺度，立方晶胞原点位于左下前角，HCP 使用理想 c/a 比展示上下密排层。',
    visual: '基体原子用亮青色高光球体，选中或示范原子用黄色高亮，框线与坐标轴保持低干扰透明显示。',
  },
  bravais: {
    goal: '理解空间点阵的平移重复，而不是只看单个晶胞。',
    interaction: '进入空间点阵模块后自动展开 2×2×2 相邻晶胞阵列。',
    logic: '复制晶胞基元并按晶格矢量平移，标出角点、面心、体心或六方层的周期延拓关系。',
    visual: '相邻晶胞使用更明亮的框线，保留原子编号用于观察重复点阵位置。',
  },
  packing: {
    goal: '把密排面和密排方向从 Miller 指数转换成可见的空间几何。',
    interaction: '高亮典型密排面，并将剖面平移展开；箭头穿过相切原子的中心表示密排方向。',
    logic: 'FCC 对应 {111}/<110>，BCC 对应 {110}/<111>，HCP 对应 {0001}/<11-20>。',
    visual: '半透明切面、展开后的虚线剖面和方向箭头同时显示，帮助对照面内原子排布。',
  },
  coordination: {
    goal: '通过点选任意原子理解配位数和最近邻定义。',
    interaction: '点击画布中的任意基体原子，该原子变为中心原子，最近邻按距离排序并编号。',
    logic: '在相邻晶胞中搜索距离中心原子最近的一组原子，数量等于当前结构配位数。',
    visual: '中心原子黄色发光，最近邻用黄色连线、编号和波纹圈标记。',
  },
  density: {
    goal: '把 APF 致密度公式与三维裁切拼合过程关联起来。',
    interaction: '进入致密度模块后显示裁切圈、拼合碎片示意，右侧 APF 柱状图同步突出当前结构。',
    logic: '按照晶胞内有效原子数和原子半径计算 APF，比较 FCC/HCP 74% 与 BCC 68%。',
    visual: '3D 中使用裁切环和拼合小球示意，2D 图表用同色柱状读数显示。',
  },
  tetra: {
    goal: '定位四面体间隙，并看清它由哪些基体原子围成。',
    interaction: '点击任一绿色间隙小球可选中该间隙，显示发光球和多面体包围线框。',
    logic: 'FCC 典型四面体间隙坐标为 (1/4,1/4,1/4) 等 8 个位置；HCP 采用上下密排层之间的典型位置。',
    visual: '间隙半径约 0.1a，选中态放大并用绿色线框显示四面体包络。',
  },
  octa: {
    goal: '定位八面体间隙，并与四面体间隙进行尺寸和位置对比。',
    interaction: '点击任一橙色间隙小球可选中该间隙，显示八面体包络。',
    logic: 'FCC 八面体间隙位于体心与棱心，BCC 位于棱心和面心附近，HCP 位于垂直对齐的三角孔之间。',
    visual: '橙色发光球表示可嵌入位置，线框用于强调八面体几何边界。',
  },
  carbon: {
    goal: '演示碳原子优先进入八面体间隙的材料学含义。',
    interaction: '点击橙色八面体间隙或左侧按钮，把灰色碳原子放入目标间隙。',
    logic: '用 FCC/BCC 间隙位置和局部畸变说明奥氏体与铁素体固溶碳能力差异。',
    visual: '碳原子未嵌入时显示运动箭头，嵌入后在目标间隙发光并保留 C 标记。',
  },
};

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
  autoRotate: false,
  exploded: false,
  sectionView: false,
};
