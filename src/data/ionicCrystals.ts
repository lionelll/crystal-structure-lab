export type IonicCrystalId =
  | 'cscl'
  | 'nacl'
  | 'zns-cubic'
  | 'zns-hex'
  | 'caf2'
  | 'catio3'
  | 'tio2-rutile';

export type IonicModuleId = 'cell' | 'bravais' | 'coordination' | 'ion-sites';
export type CrystalFamily = 'metal' | 'ionic';
export type IonicVec3 = [number, number, number];

export interface IonicSpecies {
  id: string;
  label: string;
  charge: number;
  color: string;
  radius: number;
  coordination: number;
}

export interface IonicSite {
  speciesId: string;
  fractional: IonicVec3;
}

export interface IonicCrystalInfo {
  id: IonicCrystalId;
  title: string;
  shortLabel: string;
  structureType: string;
  latticeType: string;
  lattice: [IonicVec3, IonicVec3, IonicVec3];
  latticePoints: IonicVec3[];
  species: IonicSpecies[];
  sites: IonicSite[];
  ionPositions: string;
  ionCounts: string;
  coordinationText: string;
  basis: string;
  basisIons: Array<{ speciesId: string; count: number }>;
  teaching: string;
}

export interface IonicModuleItem {
  id: IonicModuleId;
  title: string;
  summary: string;
}

export interface IonicCoordinationCenter {
  siteIndex: number;
  fractional: IonicVec3;
}

export interface IonicNeighbor {
  siteIndex: number;
  speciesId: string;
  fractional: IonicVec3;
  distance: number;
}

const A = 2.65;
export const WURTZITE_C_OVER_A = 6.2607 / 3.8227;
export const WURTZITE_U = 0.3748;
const cubic = (scale = A): [IonicVec3, IonicVec3, IonicVec3] => [
  [scale, 0, 0],
  [0, scale, 0],
  [0, 0, scale],
];
const fCentering: IonicVec3[] = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
const primitiveCentering: IonicVec3[] = [[0, 0, 0]];

const mod1 = (value: number) => ((value % 1) + 1) % 1;
const positionKey = (position: IonicVec3) => position.map((value) => mod1(value).toFixed(6)).join('|');

export function applyCentering(basis: IonicSite[], translations: IonicVec3[]): IonicSite[] {
  const result = new Map<string, IonicSite>();
  basis.forEach((site) => {
    translations.forEach((translation) => {
      const fractional: IonicVec3 = [
        mod1(site.fractional[0] + translation[0]),
        mod1(site.fractional[1] + translation[1]),
        mod1(site.fractional[2] + translation[2]),
      ];
      result.set(`${site.speciesId}|${positionKey(fractional)}`, { ...site, fractional });
    });
  });
  return [...result.values()];
}

const species = (
  id: string,
  label: string,
  charge: number,
  color: string,
  radius: number,
  coordination: number,
): IonicSpecies => ({ id, label, charge, color, radius, coordination });

const cs = species('cs', 'Cs⁺', 1, '#a78bfa', 0.36, 8);
const na = species('na', 'Na⁺', 1, '#60a5fa', 0.3, 6);
const cl = species('cl', 'Cl⁻', -1, '#4ade80', 0.36, 8);
const zn = species('zn', 'Zn²⁺', 2, '#38bdf8', 0.3, 4);
const sulfur = species('s', 'S²⁻', -2, '#facc15', 0.36, 4);
const ca = species('ca', 'Ca²⁺', 2, '#7dd3fc', 0.3, 8);
const fluorine = species('f', 'F⁻', -1, '#34d399', 0.33, 4);
const ti = species('ti', 'Ti⁴⁺', 4, '#c084fc', 0.28, 6);
const oxygen = species('o', 'O²⁻', -2, '#fb7185', 0.33, 2);

export const ionicModules: IonicModuleItem[] = [
  { id: 'cell', title: '晶胞模型', summary: '用不同颜色区分离子并显示完整晶胞。' },
  { id: 'bravais', title: '空间点阵', summary: '独立显示布拉菲点阵和结构基元。' },
  { id: 'coordination', title: '配位数', summary: '点击离子查看其周期性最近邻配位环境。' },
  { id: 'ion-sites', title: '离子位置', summary: '按离子种类高亮其在晶胞中的全部位置。' },
];

export const ionicCrystalOrder: IonicCrystalId[] = [
  'cscl',
  'nacl',
  'zns-cubic',
  'zns-hex',
  'caf2',
  'catio3',
  'tio2-rutile',
];

export const ionicCrystals: Record<IonicCrystalId, IonicCrystalInfo> = {
  cscl: {
    id: 'cscl',
    title: 'CsCl型结构',
    shortLabel: 'CsCl',
    structureType: 'CsCl型（B2）',
    latticeType: '简单立方点阵',
    lattice: cubic(),
    latticePoints: primitiveCentering,
    species: [cs, { ...cl, coordination: 8 }],
    sites: [
      { speciesId: 'cl', fractional: [0, 0, 0] },
      { speciesId: 'cs', fractional: [0.5, 0.5, 0.5] },
    ],
    ionPositions: 'Cl⁻：顶角；Cs⁺：体心',
    ionCounts: 'Cs⁺：1；Cl⁻：1',
    coordinationText: 'Cs⁺：8；Cl⁻：8',
    basis: 'Cl⁻(0,0,0) + Cs⁺(1/2,1/2,1/2)',
    basisIons: [{ speciesId: 'cl', count: 1 }, { speciesId: 'cs', count: 1 }],
    teaching: 'CsCl 型又称 B2 型结构。Cl⁻占据简单立方点阵的顶角，Cs⁺位于立方体体心；也可将两种离子的角色整体互换。每个 Cs⁺被 8 个 Cl⁻构成立方配位，每个 Cl⁻也被 8 个 Cs⁺包围。它虽然外观类似体心立方，但体心与角点是不同离子，因此其布拉菲点阵是简单立方而不是体心立方。',
  },
  nacl: {
    id: 'nacl',
    title: 'NaCl型结构',
    shortLabel: 'NaCl',
    structureType: 'NaCl型（B1）',
    latticeType: '面心立方点阵',
    lattice: cubic(),
    latticePoints: fCentering,
    species: [na, { ...cl, coordination: 6 }],
    sites: applyCentering([
      { speciesId: 'cl', fractional: [0, 0, 0] },
      { speciesId: 'na', fractional: [0.5, 0.5, 0.5] },
    ], fCentering),
    ionPositions: 'Cl⁻：顶角与面心；Na⁺：体心与棱心',
    ionCounts: 'Na⁺：4；Cl⁻：4',
    coordinationText: 'Na⁺：6；Cl⁻：6',
    basis: 'Cl⁻(0,0,0) + Na⁺(1/2,1/2,1/2)',
    basisIons: [{ speciesId: 'cl', count: 1 }, { speciesId: 'na', count: 1 }],
    teaching: 'NaCl 型又称岩盐型或 B1 型结构。Cl⁻构成面心立方密堆积，Na⁺填入全部八面体空隙，等价地可看作两个相互错开半个晶格参数的面心立方子点阵。Na⁺与 Cl⁻均为六配位，局部配位多面体是 NaCl₆ 和 ClNa₆ 八面体，晶胞内各含 4 个 Na⁺和 4 个 Cl⁻。',
  },
  'zns-cubic': {
    id: 'zns-cubic',
    title: '立方ZnS型结构',
    shortLabel: '立方ZnS',
    structureType: '闪锌矿型（B3）',
    latticeType: '面心立方点阵',
    lattice: cubic(),
    latticePoints: fCentering,
    species: [zn, sulfur],
    sites: applyCentering([
      { speciesId: 's', fractional: [0, 0, 0] },
      { speciesId: 'zn', fractional: [0.25, 0.25, 0.25] },
    ], fCentering),
    ionPositions: 'S²⁻：顶角与面心；Zn²⁺：一半四面体空隙',
    ionCounts: 'Zn²⁺：4；S²⁻：4',
    coordinationText: 'Zn²⁺：4；S²⁻：4',
    basis: 'S²⁻(0,0,0) + Zn²⁺(1/4,1/4,1/4)',
    basisIons: [{ speciesId: 's', count: 1 }, { speciesId: 'zn', count: 1 }],
    teaching: '立方 ZnS 型又称闪锌矿型或立方硫化锌型。S²⁻构成面心立方密堆积，Zn²⁺有序占据其中一半彼此不相邻的四面体空隙。每个 Zn²⁺由 4 个 S²⁻构成正四面体配位，每个 S²⁻同样连接 4 个 Zn²⁺。',
  },
  'zns-hex': {
    id: 'zns-hex',
    title: '六方ZnS型结构',
    shortLabel: '六方ZnS',
    structureType: '纤锌矿型（B4）',
    latticeType: '简单六方点阵',
    lattice: [
      [A, 0, 0],
      [-A / 2, (Math.sqrt(3) * A) / 2, 0],
      [0, 0, A * WURTZITE_C_OVER_A],
    ],
    latticePoints: primitiveCentering,
    species: [zn, sulfur],
    sites: [
      { speciesId: 'zn', fractional: [1 / 3, 2 / 3, 0] },
      { speciesId: 'zn', fractional: [2 / 3, 1 / 3, 0.5] },
      { speciesId: 's', fractional: [1 / 3, 2 / 3, WURTZITE_U] },
      { speciesId: 's', fractional: [2 / 3, 1 / 3, WURTZITE_U + 0.5] },
    ],
    ionPositions: 'Zn²⁺、S²⁻：两套沿c轴错移的六方子点阵',
    ionCounts: 'Zn²⁺：2；S²⁻：2',
    coordinationText: 'Zn²⁺：4；S²⁻：4',
    basis: 'Zn²⁺(1/3,2/3,0) + S²⁻(1/3,2/3,u)，并含 z+1/2 对应位点',
    basisIons: [{ speciesId: 'zn', count: 1 }, { speciesId: 's', count: 1 }],
    teaching: '六方 ZnS 型又称纤锌矿型。S²⁻近似构成六方密堆积，Zn²⁺占据一半四面体空隙，密排层沿 c 轴呈 ABAB 重复。本模型采用 ZnS 的近似参数 c/a≈1.638、内部参数 u≈0.375；每个 Zn²⁺与 4 个 S²⁻形成 ZnS₄ 四面体，每个 S²⁻也为四配位。其局部配位与闪锌矿相同，差异主要来自层序。',
  },
  caf2: {
    id: 'caf2',
    title: 'CaF₂型结构',
    shortLabel: 'CaF₂',
    structureType: '萤石型（C1）',
    latticeType: '面心立方点阵',
    lattice: cubic(),
    latticePoints: fCentering,
    species: [ca, fluorine],
    sites: applyCentering([
      { speciesId: 'ca', fractional: [0, 0, 0] },
      { speciesId: 'f', fractional: [0.25, 0.25, 0.25] },
      { speciesId: 'f', fractional: [0.75, 0.75, 0.75] },
    ], fCentering),
    ionPositions: 'Ca²⁺：顶角与面心；F⁻：全部四面体空隙',
    ionCounts: 'Ca²⁺：4；F⁻：8',
    coordinationText: 'Ca²⁺：8；F⁻：4',
    basis: 'Ca²⁺(0,0,0) + F⁻(1/4,1/4,1/4)、F⁻(3/4,3/4,3/4)',
    basisIons: [{ speciesId: 'ca', count: 1 }, { speciesId: 'f', count: 2 }],
    teaching: 'CaF₂ 型又称萤石型。Ca²⁺构成面心立方子点阵，F⁻填充该点阵的全部四面体空隙，因此一个常规晶胞含 4 个 Ca²⁺和 8 个 F⁻。每个 Ca²⁺被 8 个 F⁻构成立方配位，每个 F⁻则位于 4 个 Ca²⁺围成的四面体中心，体现 8:4 的异配位关系。',
  },
  catio3: {
    id: 'catio3',
    title: 'CaTiO₃型结构',
    shortLabel: 'CaTiO₃',
    structureType: '钙钛矿型',
    latticeType: '简单立方点阵',
    lattice: cubic(),
    latticePoints: primitiveCentering,
    species: [{ ...ca, coordination: 12 }, ti, { ...oxygen, coordination: 2 }],
    sites: [
      { speciesId: 'ca', fractional: [0, 0, 0] },
      { speciesId: 'ti', fractional: [0.5, 0.5, 0.5] },
      { speciesId: 'o', fractional: [0.5, 0.5, 0] },
      { speciesId: 'o', fractional: [0.5, 0, 0.5] },
      { speciesId: 'o', fractional: [0, 0.5, 0.5] },
    ],
    ionPositions: 'Ca²⁺：顶角；Ti⁴⁺：体心；O²⁻：面心',
    ionCounts: 'Ca²⁺：1；Ti⁴⁺：1；O²⁻：3',
    coordinationText: 'Ca²⁺：12；Ti⁴⁺：6；O²⁻：2(Ti)',
    basis: 'Ca²⁺(0,0,0) + Ti⁴⁺(1/2,1/2,1/2) + 3个面心O²⁻',
    basisIons: [{ speciesId: 'ca', count: 1 }, { speciesId: 'ti', count: 1 }, { speciesId: 'o', count: 3 }],
    teaching: 'CaTiO₃ 是钙钛矿的原型。Ca²⁺位于立方体顶角，O²⁻位于 6 个面心的有效 3 个位置，较小的 Ti⁴⁺占据体心并填入 6 个 O²⁻构成的 [TiO₆] 八面体。Ca²⁺处于 12 配位的立方八面体空隙中，相邻 [TiO₆] 八面体以顶点相连。',
  },
  'tio2-rutile': {
    id: 'tio2-rutile',
    title: 'TiO₂(金红石)型结构',
    shortLabel: 'TiO₂(金红石)',
    structureType: '金红石型（C4）',
    latticeType: '简单四方点阵',
    lattice: [[A, 0, 0], [0, A, 0], [0, 0, A * 0.644]],
    latticePoints: primitiveCentering,
    species: [ti, { ...oxygen, coordination: 3 }],
    sites: (() => {
      const u = 0.3048;
      return [
        { speciesId: 'ti', fractional: [0, 0, 0] as IonicVec3 },
        { speciesId: 'ti', fractional: [0.5, 0.5, 0.5] as IonicVec3 },
        { speciesId: 'o', fractional: [u, u, 0] as IonicVec3 },
        { speciesId: 'o', fractional: [1 - u, 1 - u, 0] as IonicVec3 },
        { speciesId: 'o', fractional: [0.5 - u, 0.5 + u, 0.5] as IonicVec3 },
        { speciesId: 'o', fractional: [0.5 + u, 0.5 - u, 0.5] as IonicVec3 },
      ];
    })(),
    ionPositions: 'Ti⁴⁺：顶角与体心；O²⁻：四方晶胞4f位置(u≈0.305)',
    ionCounts: 'Ti⁴⁺：2；O²⁻：4',
    coordinationText: 'Ti⁴⁺：6；O²⁻：3',
    basis: 'Ti⁴⁺(0,0,0)、Ti⁴⁺(1/2,1/2,1/2) + 4个O²⁻(u≈0.305)',
    basisIons: [{ speciesId: 'ti', count: 1 }, { speciesId: 'o', count: 2 }],
    teaching: 'TiO₂ 金红石型又称 C4 型结构，属于简单四方点阵。Ti⁴⁺位于顶角和体心等效位置，O²⁻占据由内部参数 u≈0.305 决定的 4f 位点。',
  },
};

export function isIonicCrystalId(value: string): value is IonicCrystalId {
  return Object.prototype.hasOwnProperty.call(ionicCrystals, value);
}

export function resolveIonicCrystal(value: string | null | undefined): IonicCrystalInfo {
  return value && isIonicCrystalId(value) ? ionicCrystals[value] : ionicCrystals.cscl;
}

export function ionicSpeciesMap(crystal: IonicCrystalInfo) {
  return new Map(crystal.species.map((item) => [item.id, item]));
}

export function ionicDefaultSupercell(_id: IonicCrystalId) {
  return false;
}

export function fractionalToCartesian(lattice: IonicCrystalInfo['lattice'], fractional: IonicVec3): IonicVec3 {
  const [a, b, c] = lattice;
  return [
    a[0] * fractional[0] + b[0] * fractional[1] + c[0] * fractional[2],
    a[1] * fractional[0] + b[1] * fractional[1] + c[1] * fractional[2],
    a[2] * fractional[0] + b[2] * fractional[1] + c[2] * fractional[2],
  ];
}

export function ionicCoordinationShell(
  crystal: IonicCrystalInfo,
  center: IonicCoordinationCenter,
): IonicNeighbor[] {
  const speciesById = ionicSpeciesMap(crystal);
  const centerSpecies = speciesById.get(crystal.sites[center.siteIndex].speciesId);
  if (!centerSpecies) return [];
  const candidates = new Map<string, IonicNeighbor>();
  const originCell = center.fractional.map(Math.floor) as IonicVec3;
  for (let tx = originCell[0] - 2; tx <= originCell[0] + 2; tx++) {
    for (let ty = originCell[1] - 2; ty <= originCell[1] + 2; ty++) {
      for (let tz = originCell[2] - 2; tz <= originCell[2] + 2; tz++) {
        crystal.sites.forEach((site, siteIndex) => {
          const candidateSpecies = speciesById.get(site.speciesId);
          if (!candidateSpecies || Math.sign(candidateSpecies.charge) === Math.sign(centerSpecies.charge)) return;
          const fractional: IonicVec3 = [site.fractional[0] + tx, site.fractional[1] + ty, site.fractional[2] + tz];
          const delta: IonicVec3 = [
            fractional[0] - center.fractional[0],
            fractional[1] - center.fractional[1],
            fractional[2] - center.fractional[2],
          ];
          const cartesian = fractionalToCartesian(crystal.lattice, delta);
          const distance = Math.hypot(...cartesian);
          if (distance < 1e-7) return;
          const key = `${site.speciesId}|${fractional.map((value) => value.toFixed(6)).join('|')}`;
          candidates.set(key, { siteIndex, speciesId: site.speciesId, fractional, distance });
        });
      }
    }
  }
  return [...candidates.values()]
    .sort((left, right) => left.distance - right.distance)
    .slice(0, centerSpecies.coordination);
}
