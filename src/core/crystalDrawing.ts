export type Point3 = [number, number, number];
export type DrawingMode = 'plane' | 'direction';
export type IndexDraft = [string, string, string];

interface DrawingBase {
  indices: Point3;
  origin: Point3;
}
export type CrystalDrawing =
  | (DrawingBase & { mode: 'plane'; vertices: Point3[] })
  | (DrawingBase & { mode: 'direction'; end: Point3; divisor: number });

export const cubeCorners: Point3[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
export const cubeEdges = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6],
  [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
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

export function drawingOrigin(indices: Point3): Point3 {
  return indices.map((value) => value < 0 ? 1 : 0) as Point3;
}

const dot = (a: Point3, b: Point3) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const sub = (a: Point3, b: Point3) => a.map((value, i) => value - b[i]) as Point3;
const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];

export function planeVertices(indices: Point3, origin: Point3): Point3[] {
  const vertices: Point3[] = [];
  const add = (point: Point3) => {
    if (!vertices.some((existing) => Math.hypot(...sub(existing, point)) < 1e-10)) vertices.push(point);
  };
  // Intersect all cell edges: zero indices produce rectangles, not intercept triangles.
  for (const [a, b] of cubeEdges) {
    const start = cubeCorners[a];
    const end = cubeCorners[b];
    const from = dot(indices, sub(start, origin)) - 1;
    const to = dot(indices, sub(end, origin)) - 1;
    if (from === 0) add([...start]);
    if (to === 0) add([...end]);
    if ((from < 0 && to > 0) || (from > 0 && to < 0)) {
      const t = from / (from - to);
      add(start.map((value, i) => value + t * (end[i] - value)) as Point3);
    }
  }
  if (vertices.length < 3) throw new Error('指数过大，当前精度下无法清晰绘制晶面。');
  const center = vertices.reduce<Point3>((sum, point) => sum.map((v, i) => v + point[i] / vertices.length) as Point3, [0, 0, 0]);
  const magnitude = Math.hypot(...indices);
  const normal = indices.map((v) => v / magnitude) as Point3;
  const axis = Math.abs(normal[0]) < 0.8 ? [1, 0, 0] as Point3 : [0, 1, 0] as Point3;
  const tangent = cross(normal, axis);
  const bitangent = cross(normal, tangent);
  const angle = (point: Point3) => Math.atan2(dot(sub(point, center), bitangent), dot(sub(point, center), tangent));
  return vertices.sort((a, b) => angle(a) - angle(b));
}

export function createCrystalDrawing(mode: DrawingMode, indices: Point3): CrystalDrawing {
  parseIndices(indices.map(String) as IndexDraft);
  const origin = drawingOrigin(indices);
  if (mode === 'plane') return { mode, indices: [...indices], origin, vertices: planeVertices(indices, origin) };
  const divisor = Math.max(...indices.map(Math.abs));
  const end = origin.map((value, i) => value + indices[i] / divisor) as Point3;
  return { mode, indices: [...indices], origin, end, divisor };
}

export function formatDrawingIndex(mode: DrawingMode, indices: Point3) {
  const parts = indices.map((v) => v < 0 ? String(Math.abs(v)).split('').map((digit) => `${digit}\u0305`).join('') : String(v));
  const text = parts.join(indices.some((v) => Math.abs(v) > 9) ? ' ' : '');
  return mode === 'plane' ? `(${text})` : `[${text}]`;
}

export function fractionText(numerator: number, denominator = 1) {
  if (numerator === 0) return '0';
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const factor = gcd(Math.abs(numerator), Math.abs(denominator));
  const n = numerator / factor * Math.sign(denominator);
  const d = Math.abs(denominator / factor);
  return d === 1 ? String(n) : `${n}/${d}`;
}

export function interceptText(index: number) {
  return index === 0 ? '∞（平行）' : `${fractionText(1, index)}a`;
}
