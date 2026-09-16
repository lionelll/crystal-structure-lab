import { parseHexIndices, parseIndices, type DrawingMode, type HexIndexDraft, type IndexDraft, type Point3, type Point4 } from './crystalDrawing';

function safeIntegers(values: bigint[]) {
  const result = values.map(Number);
  if (!result.every(Number.isSafeInteger)) throw new Error('转换后的指数超出可计算的整数范围。');
  return result;
}

function integerRatio(values: bigint[]) {
  const gcd = (a: bigint, b: bigint): bigint => b === 0n ? a : gcd(b, a % b);
  const divisor = values.reduce((factor, value) => gcd(factor, value < 0n ? -value : value), 0n);
  return values.map((value) => value / divisor);
}

// Directions are real-space components; planes retain h, k, l in reciprocal space.
// Source: https://www.phase-trans.msm.cam.ac.uk/map/crystal/subs/notat1-b.html
export function threeToFourIndices(mode: DrawingMode, indices: Point3): Point4 {
  const [a, b, c] = parseIndices(indices.map(String) as IndexDraft).map(BigInt);
  const values = mode === 'plane'
    ? [a, b, -a - b, c]
    : integerRatio([2n * a - b, 2n * b - a, -a - b, 3n * c]);
  return safeIntegers(values) as Point4;
}

export function fourToThreeIndices(mode: DrawingMode, indices: Point4): Point3 {
  const [a, b, t, c] = parseHexIndices(indices.map(String) as HexIndexDraft).map(BigInt);
  return safeIntegers(mode === 'plane' ? [a, b, c] : integerRatio([a - t, b - t, c])) as Point3;
}

export function dependentHexIndex(first: string, second: string): string {
  if (![first, second].every((value) => /^[+-]?\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)))) return '';
  try { return String(safeIntegers([-BigInt(first.trim()) - BigInt(second.trim())])[0]); }
  catch { return ''; }
}
