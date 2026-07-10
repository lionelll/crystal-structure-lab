export type CrystalType = 'FCC' | 'BCC' | 'HCP';
export type PositionTuple = readonly [number, number, number];

export interface ClippingPlaneSpec {
  normal: PositionTuple;
  constant: number;
}

export interface DensityContribution {
  site: 'corner' | 'face' | 'interior';
  count: number;
  fraction: number;
  effective: number;
}

const idealHcpRatio = Math.sqrt(8 / 3);

export const latticeGeometry = {
  FCC: {
    worldA: 2.65,
    atomRadiusOverA: Math.SQRT2 / 4,
  },
  BCC: {
    worldA: 2.65,
    atomRadiusOverA: Math.sqrt(3) / 4,
  },
  HCP: {
    worldA: 1.8,
    atomRadiusOverA: 0.5,
    cOverA: idealHcpRatio,
  },
} as const;

export const hcpGeometry = (() => {
  const a = latticeGeometry.HCP.worldA;
  const c = a * latticeGeometry.HCP.cOverA;
  const ring = Array.from({ length: 6 }, (_, index): PositionTuple => {
    const angle = (index * Math.PI) / 3;
    return [Math.cos(angle) * a, Math.sin(angle) * a, 0];
  });
  const holeRadius = a / Math.sqrt(3);
  const upperHoles = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2].map(
    (angle): PositionTuple => [Math.cos(angle) * holeRadius, Math.sin(angle) * holeRadius, 0],
  );
  const lowerHoles = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6].map(
    (angle): PositionTuple => [Math.cos(angle) * holeRadius, Math.sin(angle) * holeRadius, 0],
  );

  // These are superlattice translations of the 120-degree hexagonal basis.
  // They tile the conventional hexagonal prism without rectangular-grid drift.
  const tileVectorA: PositionTuple = [1.5 * a, (Math.sqrt(3) / 2) * a, 0];
  const tileVectorB: PositionTuple = [0, -Math.sqrt(3) * a, 0];

  return {
    a,
    c,
    ring,
    upperHoles,
    lowerHoles,
    tileVectorA,
    tileVectorB,
    cVector: [0, 0, c] as PositionTuple,
  };
})();

export function hcpCellOffset(ix: number, iy: number, iz: number, repeat: number): PositionTuple {
  const u = ix - (repeat - 1) / 2;
  const v = iy - (repeat - 1) / 2;
  const w = iz - (repeat - 1) / 2;
  return hcpTranslation(u, v, w);
}

export function hcpTranslation(u: number, v: number, w: number): PositionTuple {
  const { tileVectorA: a, tileVectorB: b, cVector: c } = hcpGeometry;
  return [
    u * a[0] + v * b[0] + w * c[0],
    u * a[1] + v * b[1] + w * c[1],
    u * a[2] + v * b[2] + w * c[2],
  ];
}

export function hcpCellAtoms(includeBasis = true): Array<{ position: PositionTuple; kind: 'base' | 'face' | 'center' }> {
  const { c, ring, upperHoles } = hcpGeometry;
  const bottom = ring.map(([x, y]): { position: PositionTuple; kind: 'base' } => ({ position: [x, y, -c / 2], kind: 'base' }));
  const top = ring.map(([x, y]): { position: PositionTuple; kind: 'base' } => ({ position: [x, y, c / 2], kind: 'base' }));
  const atoms: Array<{ position: PositionTuple; kind: 'base' | 'face' | 'center' }> = [
    ...bottom,
    { position: [0, 0, -c / 2], kind: 'face' },
    ...top,
    { position: [0, 0, c / 2], kind: 'face' },
  ];
  if (includeBasis) {
    upperHoles.forEach(([x, y]) => atoms.push({ position: [x, y, 0], kind: 'center' }));
  }
  return atoms;
}

export function hcpGapPositions(kind: 'tetra' | 'octa'): PositionTuple[] {
  const { c, upperHoles, lowerHoles } = hcpGeometry;
  if (kind === 'octa') {
    return [-c / 4, c / 4].flatMap((z) => lowerHoles.map(([x, y]): PositionTuple => [x, y, z]));
  }
  return [
    ...upperHoles.map(([x, y]): PositionTuple => [x, y, -3 * c / 8]),
    ...lowerHoles.map(([x, y]): PositionTuple => [x, y, -c / 8]),
    ...lowerHoles.map(([x, y]): PositionTuple => [x, y, c / 8]),
    ...upperHoles.map(([x, y]): PositionTuple => [x, y, 3 * c / 8]),
  ];
}

export function sectionClippingPlaneSpec(): ClippingPlaneSpec {
  return { normal: [1, 0, 0], constant: 0 };
}

export function densityCellClippingPlaneSpecs(crystal: CrystalType): ClippingPlaneSpec[] {
  if (crystal !== 'HCP') {
    const half = latticeGeometry[crystal].worldA / 2;
    return [
      { normal: [1, 0, 0], constant: half },
      { normal: [-1, 0, 0], constant: half },
      { normal: [0, 1, 0], constant: half },
      { normal: [0, -1, 0], constant: half },
      { normal: [0, 0, 1], constant: half },
      { normal: [0, 0, -1], constant: half },
    ];
  }

  const apothem = hcpGeometry.a * Math.cos(Math.PI / 6);
  const sidePlanes = Array.from({ length: 6 }, (_, index): ClippingPlaneSpec => {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    return { normal: [-Math.cos(angle), -Math.sin(angle), 0], constant: apothem };
  });
  return [
    ...sidePlanes,
    { normal: [0, 0, 1], constant: hcpGeometry.c / 2 },
    { normal: [0, 0, -1], constant: hcpGeometry.c / 2 },
  ];
}

export function hcpDensityContributions(): DensityContribution[] {
  return [
    { site: 'corner', count: 12, fraction: 1 / 6, effective: 2 },
    { site: 'face', count: 2, fraction: 1 / 2, effective: 1 },
    { site: 'interior', count: 3, fraction: 1, effective: 3 },
  ];
}
