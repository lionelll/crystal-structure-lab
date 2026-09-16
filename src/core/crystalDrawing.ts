export type Point3 = [number, number, number];
export type Point4 = [number, number, number, number];
export type DrawingMode = 'plane' | 'direction';
export type DrawingCrystalSystem = 'cubic' | 'hexagonal';
export type IndexDraft = [string, string, string];
export type HexIndexDraft = [string, string, string, string];
export type DrawingIndices = Point3 | Point4;
export interface DrawingIndexToken {
  text: string;
  negative: boolean;
}

interface DrawingBase {
  crystalSystem: DrawingCrystalSystem;
  indices: DrawingIndices;
  origin: Point3;
}
export type CrystalDrawing =
  | (DrawingBase & { mode: 'plane'; vertices: Point3[]; planeLevel: number })
  | (DrawingBase & { mode: 'direction'; end: Point3; divisor: number });

export const cubeCorners: Point3[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
export const cubeEdges = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6],
  [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
] as const;

const hexRadius = 0.5;
export const hexPrismCorners: Point3[] = [
  ...Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    return [hexRadius * Math.cos(angle), hexRadius * Math.sin(angle), -0.5] as Point3;
  }),
  ...Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    return [hexRadius * Math.cos(angle), hexRadius * Math.sin(angle), 0.5] as Point3;
  }),
];
export const hexPrismEdges = [
  ...Array.from({ length: 6 }, (_, index) => [index, (index + 1) % 6] as const),
  ...Array.from({ length: 6 }, (_, index) => [index + 6, ((index + 1) % 6) + 6] as const),
  ...Array.from({ length: 6 }, (_, index) => [index, index + 6] as const),
] as const;

export function parseIndices(draft: IndexDraft): Point3 {
  if (!draft.every((value) => /^[+-]?\d+$/.test(value.trim()))) {
    throw new Error('请输入三个整数，可包含负号。');
  }
  const indices = draft.map(Number) as Point3;
  if (!indices.every(Number.isSafeInteger)) throw new Error('指数超出可计算的整数范围。');
  if (indices.every((value) => value === 0)) throw new Error('三个指数不能同时为 0。');
  return indices;
}

export function parseHexIndices(draft: HexIndexDraft): Point4 {
  if (!draft.every((value) => /^[+-]?\d+$/.test(value.trim()))) {
    throw new Error('请输入四个整数，可包含负号。');
  }
  const indices = draft.map(Number) as Point4;
  if (!indices.every(Number.isSafeInteger)) throw new Error('指数超出可计算的整数范围。');
  if (indices.every((value) => value === 0)) throw new Error('四个指数不能同时为 0。');
  if (indices[2] !== -(indices[0] + indices[1])) {
    throw new Error('六方四指数必须满足 i/t = -(h/u + k/v)。');
  }
  return indices;
}

export function drawingOrigin(indices: Point3): Point3 {
  return indices.map((value) => value < 0 ? 1 : 0) as Point3;
}

const dot = (a: Point3, b: Point3) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const sub = (a: Point3, b: Point3) => a.map((value, i) => value - b[i]) as Point3;
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];

function clipPlaneToConvexCell(
  corners: Point3[],
  edges: readonly (readonly [number, number])[],
  signedDistance: (point: Point3) => number,
  normal: Point3,
  errorMessage: string,
): Point3[] {
  const vertices: Point3[] = [];
  const add = (point: Point3) => {
    if (!vertices.some((existing) => Math.hypot(...sub(existing, point)) < 1e-10)) vertices.push(point);
  };
  for (const [a, b] of edges) {
    const start = corners[a];
    const end = corners[b];
    const from = signedDistance(start);
    const to = signedDistance(end);
    if (Math.abs(from) < 1e-12) add([...start]);
    if (Math.abs(to) < 1e-12) add([...end]);
    if ((from < 0 && to > 0) || (from > 0 && to < 0)) {
      const ratio = from / (from - to);
      add(start.map((value, index) => value + ratio * (end[index] - value)) as Point3);
    }
  }
  if (vertices.length < 3) throw new Error(errorMessage);
  const center = vertices.reduce<Point3>((sum, point) => sum.map((value, index) => value + point[index] / vertices.length) as Point3, [0, 0, 0]);
  const magnitude = Math.hypot(...normal);
  const unitNormal = normal.map((value) => value / magnitude) as Point3;
  const axis = Math.abs(unitNormal[0]) < 0.8 ? [1, 0, 0] as Point3 : [0, 1, 0] as Point3;
  const tangent = cross(unitNormal, axis);
  const bitangent = cross(unitNormal, tangent);
  const angle = (point: Point3) => Math.atan2(dot(sub(point, center), bitangent), dot(sub(point, center), tangent));
  return vertices.sort((a, b) => angle(a) - angle(b));
}

export function planeVertices(indices: Point3, origin: Point3): Point3[] {
  // Intersect all cell edges: zero indices produce rectangles, not intercept triangles.
  return clipPlaneToConvexCell(
    cubeCorners,
    cubeEdges,
    (point) => dot(indices, sub(point, origin)) - 1,
    indices,
    '指数过大，当前精度下无法清晰绘制晶面。',
  );
}

const hexPlaneNormal = ([h, k, , l]: Point4): Point3 => [h, (h + 2 * k) / Math.sqrt(3), l];

export function hexagonalPlaneCoordinate(indices: Point4, point: Point3) {
  const normal = hexPlaneNormal(indices);
  return (normal[0] * point[0] + normal[1] * point[1]) / hexRadius + indices[3] * (point[2] + 0.5);
}

export function hexagonalPlaneLevel(indices: Point4) {
  const values = hexPrismCorners.map((point) => hexagonalPlaneCoordinate(indices, point));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum - 1e-12 <= 1 && maximum + 1e-12 >= 1) return 1;
  if (minimum - 1e-12 <= -1 && maximum + 1e-12 >= -1) return -1;
  throw new Error('当前六方晶面无法在晶胞内清晰绘制。');
}

export function hexagonalPlaneVertices(indices: Point4): Point3[] {
  const normal = hexPlaneNormal(indices);
  const level = hexagonalPlaneLevel(indices);
  return clipPlaneToConvexCell(
    hexPrismCorners,
    hexPrismEdges,
    (point) => hexagonalPlaneCoordinate(indices, point) - level,
    normal,
    '当前六方晶面无法在晶胞内清晰绘制。',
  );
}

export function hexagonalDirectionEnd(indices: Point4): { origin: Point3; end: Point3; divisor: number } {
  const [u, v, t, w] = indices;
  const direction: Point3 = [u - (v + t) / 2, Math.sqrt(3) * (v - t) / 2, w];
  const magnitude = Math.hypot(...direction);
  if (magnitude === 0) throw new Error('六方晶向的方向矢量不能为 0。');
  const unit = direction.map((value) => value / magnitude) as Point3;
  const origin: Point3 = [0, 0, w < 0 ? 0.5 : -0.5];
  let distance = Infinity;
  for (let index = 0; index < 6; index++) {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    const projection = unit[0] * Math.cos(angle) + unit[1] * Math.sin(angle);
    if (projection > 1e-12) distance = Math.min(distance, hexRadius * Math.cos(Math.PI / 6) / projection);
  }
  if (unit[2] > 1e-12) distance = Math.min(distance, (0.5 - origin[2]) / unit[2]);
  if (unit[2] < -1e-12) distance = Math.min(distance, (-0.5 - origin[2]) / unit[2]);
  if (!Number.isFinite(distance) || distance <= 0) distance = hexRadius;
  const end = origin.map((value, index) => value + unit[index] * distance) as Point3;
  return { origin, end, divisor: Math.max(...indices.map(Math.abs)) };
}

export function createCrystalDrawing(mode: DrawingMode, indices: Point3): CrystalDrawing {
  parseIndices(indices.map(String) as IndexDraft);
  const origin = drawingOrigin(indices);
  if (mode === 'plane') return { crystalSystem: 'cubic', mode, indices: [...indices], origin, vertices: planeVertices(indices, origin), planeLevel: 1 };
  const divisor = Math.max(...indices.map(Math.abs));
  const end = origin.map((value, i) => value + indices[i] / divisor) as Point3;
  return { crystalSystem: 'cubic', mode, indices: [...indices], origin, end, divisor };
}

export function createHexagonalDrawing(mode: DrawingMode, indices: Point4): CrystalDrawing {
  parseHexIndices(indices.map(String) as HexIndexDraft);
  if (mode === 'plane') {
    return { crystalSystem: 'hexagonal', mode, indices: [...indices], origin: [0, 0, -0.5], vertices: hexagonalPlaneVertices(indices), planeLevel: hexagonalPlaneLevel(indices) };
  }
  const { origin, end, divisor } = hexagonalDirectionEnd(indices);
  return { crystalSystem: 'hexagonal', mode, indices: [...indices], origin, end, divisor };
}

export function drawingIndexTokens(indices: DrawingIndices): DrawingIndexToken[] {
  return indices.map((value) => ({ text: String(Math.abs(value)), negative: value < 0 }));
}

export function fractionText(numerator: number, denominator = 1) {
  if (numerator === 0) return '0';
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const factor = gcd(Math.abs(numerator), Math.abs(denominator));
  const n = numerator / factor * Math.sign(denominator);
  const d = Math.abs(denominator / factor);
  return d === 1 ? String(n) : `${n}/${d}`;
}

export function interceptText(index: number, planeLevel = 1) {
  return index === 0 ? '∞（平行）' : `${fractionText(planeLevel, index)}a`;
}
