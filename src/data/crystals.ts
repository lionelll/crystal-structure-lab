import { latticeGeometry, type CrystalType } from './latticeGeometry';

export type { CrystalType } from './latticeGeometry';
export type ModuleId =
  | 'cell'
  | 'bravais'
  | 'packing'
  | 'coordination'
  | 'tetra'
  | 'octa';

export type ModelStyle = 'rigid' | 'schematic' | 'ball-stick';

export interface DisplaySettings {
  modelStyle: ModelStyle;
  showSupercell: boolean;
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
  densePlane: string;
  denseDirection: string;
  teaching: string;
  bravais: string;
  packing: string;
  gaps: {
    tetra: string;
    octa: string;
  };
}

export interface ModuleItem {
  id: ModuleId;
  index: number;
  title: string;
  summary: string;
}

export const modules: ModuleItem[] = [
  { id: 'cell', index: 1, title: '晶胞模型', summary: '展示基体原子、晶胞框线、坐标轴和模型类型切换。' },
  { id: 'bravais', index: 2, title: '空间点阵', summary: '用独立格点展示布拉菲点阵，并可扩展观察平移重复特征。' },
  { id: 'packing', index: 3, title: '密排面 / 密排方向', summary: '高亮典型密排面，并用箭头标示密排方向。' },
  { id: 'coordination', index: 4, title: '配位数', summary: '选择中心原子，按距离高亮最近邻并编号。' },
  { id: 'tetra', index: 5, title: '四面体间隙', summary: '显示四面体间隙位置和围成间隙的基体原子。' },
  { id: 'octa', index: 6, title: '八面体间隙', summary: '显示八面体间隙位置和多面体连接。' },
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
    densePlane: '{111}',
    denseDirection: '<110>',
    teaching: 'FCC 的密排面为 {111}，密排方向为 <110>，每个原子周围有 12 个等距离最近邻原子，密排层按 ABCABC 顺序堆垛。',
    bravais: '角点和六个面心点共同构成面心立方点阵。2×2×2 阵列能直观看到面心点沿相邻晶胞连续平移。',
    packing: '面心立方的 {111} 面呈三角密排，面内原子沿 <110> 方向相切排列。',
    gaps: {
      tetra: 'FCC 每个晶胞含 8 个四面体间隙，典型坐标为 (1/4,1/4,1/4)。',
      octa: 'FCC 每个晶胞含 4 个八面体间隙，典型坐标为 (1/2,1/2,1/2) 与棱心。',
    },
  },
  BCC: {
    type: 'BCC',
    title: '体心立方结构',
    latticeName: '体心立方点阵',
    latticeConstant: 'a = 1.0000',
    radius: `R = ${latticeGeometry.BCC.atomRadiusOverA.toFixed(4)}a`,
    atomsPerCell: '2',
    coordination: 8,
    densePlane: '{110}',
    denseDirection: '<111>',
    teaching: 'BCC 的原子沿体对角线相切，配位数为 8。它不是密排结构，{110} 是原子排列最密的晶面。',
    bravais: '八个角点加一个体心点构成体心立方点阵，中心点与角点沿体对角线重复。',
    packing: 'BCC 不是密排结构。{110} 是其最密排面（非真正密排面），<111> 是最密方向。',
    gaps: {
      tetra: 'BCC 四面体间隙较多但不规则，碳进入后会引起显著畸变。',
      octa: 'BCC 八面体间隙位于棱心和面心附近，实际有效半径较小。',
    },
  },
  HCP: {
    type: 'HCP',
    title: '密排六方结构',
    latticeName: '六方点阵 + 双原子基元',
    latticeConstant: `a = 1.0000, c/a = ${latticeGeometry.HCP.cOverA.toFixed(3)}`,
    radius: `R = ${latticeGeometry.HCP.atomRadiusOverA.toFixed(4)}a`,
    atomsPerCell: '6',
    coordination: 12,
    densePlane: '{0001}',
    denseDirection: '<11-20>',
    teaching: 'HCP 与 FCC 都属于密排结构，配位数均为 12。两者的主要区别是密排层堆垛方式：HCP 为 ABAB，FCC 为 ABCABC。',
    bravais: 'HCP 可通过六方柱状晶胞理解，底面为密排六角层，中间层错位嵌入。',
    packing: 'HCP 的密排面是基面 {0001}，密排方向在基面内沿 <11-20>。',
    gaps: {
      tetra: 'HCP 的四面体间隙位于上下密排层之间，与 FCC 数量关系类似。',
      octa: 'HCP 的八面体间隙位于两层三角孔垂直对齐处。',
    },
  },
};

export const defaultSettings: DisplaySettings = {
  modelStyle: 'schematic',
  showSupercell: false,
  autoRotate: true,
  exploded: false,
  sectionView: false,
};
