import type { CrystalType } from './latticeGeometry';

export type { CrystalType } from './latticeGeometry';
export type ModuleId =
  | 'cell'
  | 'stacking'
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
  stacking: string;
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
  { id: 'cell', index: 1, title: '晶胞模型', summary: '展示基体原子、晶胞框线和晶系坐标轴。' },
  { id: 'stacking', index: 2, title: '堆垛模型', summary: '展示晶体沿典型方向的逐层堆垛关系。' },
  { id: 'bravais', index: 3, title: '空间点阵', summary: '用独立格点展示布拉菲点阵，并可扩展观察平移重复特征。' },
  { id: 'packing', index: 4, title: '密排面 / 密排方向', summary: '高亮典型密排面，并用箭头标示密排方向。' },
  { id: 'coordination', index: 5, title: '配位数', summary: '选择中心原子，按距离高亮最近邻。' },
  { id: 'tetra', index: 6, title: '四面体间隙', summary: '显示四面体间隙位置和围成间隙的基体原子。' },
  { id: 'octa', index: 7, title: '八面体间隙', summary: '显示八面体间隙位置和多面体连接。' },
];


export const crystals: Record<CrystalType, CrystalInfo> = {
  FCC: {
    type: 'FCC',
    title: '面心立方结构',
    latticeName: '面心立方点阵',
    latticeConstant: 'a = 1',
    radius: 'R = √2a / 4',
    atomsPerCell: '4',
    coordination: 12,
    densePlane: '{111}',
    denseDirection: '<110>',
    teaching: 'FCC 的密排面为 {111}，密排方向为 <110>，每个原子周围有 12 个等距离最近邻原子，密排层按 ABCABC 顺序堆垛。',
    bravais: '角点和六个面心点共同构成面心立方点阵。2×2×2 阵列能直观看到面心点沿相邻晶胞连续平移。',
    stacking: 'FCC 沿 <111> 方向由密排层按 ABCABC 顺序堆垛，相邻层占据不同的三角孔位置。',
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
    latticeConstant: 'a = 1',
    radius: 'R = √3a / 4',
    atomsPerCell: '2',
    coordination: 8,
    densePlane: '{110}',
    denseDirection: '<111>',
    teaching: 'BCC 的原子沿体对角线相切，配位数为 8。它不是密排结构，{110} 是原子排列最密的晶面；沿 [001] 的交替层可表示为 ABAB…。',
    bravais: '八个角点加一个体心点构成体心立方点阵，中心点与角点沿体对角线重复。',
    stacking: 'BCC 不是密排结构。沿 [001] 将角点方形层记为 A、偏移半个晶格的体心层记为 B，可得到 ABAB…交替层序；这不同于 FCC/HCP 的密排层堆垛。',
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
    latticeConstant: 'a = 1, c/a = √(8/3)',
    radius: 'R = a / 2',
    atomsPerCell: '6',
    coordination: 12,
    densePlane: '{0001}',
    denseDirection: '<11-20>',
    teaching: 'HCP 与 FCC 都属于密排结构，配位数均为 12。两者的主要区别是密排层堆垛方式：HCP 为 ABAB，FCC 为 ABCABC。',
    bravais: 'HCP 可通过六方柱状晶胞理解，底面为密排六角层，中间层错位嵌入。',
    stacking: 'HCP 的 {0001} 密排层沿 c 轴按 ABAB…顺序堆垛，第三层 A 回到第一层 A 的正上方。',
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
