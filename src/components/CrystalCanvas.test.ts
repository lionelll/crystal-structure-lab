import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AUTO_ROTATE_RADIANS_PER_FRAME,
  atomOpacityForModule,
  atomRenderRadius,
  atomVisualStyle,
  bcc111DirectionEndpoints,
  bravaisPointStyle,
  cameraPreset,
  cellFrameRepeat,
  COORDINATION_TRANSITION_MS,
  coordinationTransitionEase,
  coordinationVisualStyle,
  coordinationShell,
  createAtoms,
  createBravaisSites,
  deduplicateAtoms,
  fcc110DirectionEndpoints,
  fcc111PackingSites,
  findSurroundingAtoms,
  gapVisualStyle,
  getGapLabel,
  getGapPositions,
  nearestNeighborBondPairs,
  packingDirectionStyle,
  polyhedronEdges,
} from './CrystalCanvas';
import { crystals, defaultSettings, modules } from '../data/crystals';
import {
  hcpGeometry,
  latticeGeometry,
  sectionClippingPlaneSpec,
  type CrystalType,
} from '../data/latticeGeometry';

function positionKey(point: THREE.Vector3) {
  return point.toArray().map((value) => value.toFixed(6)).join(',');
}

function nearestDistance(crystal: CrystalType) {
  const atoms = createAtoms(crystal, 1, false, 'cell').map((atom) => atom.position);
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const distance = atoms[i].distanceTo(atoms[j]);
      if (distance > 1e-6) nearest = Math.min(nearest, distance);
    }
  }
  return nearest;
}

describe('module and settings cleanup', () => {
  it('keeps exactly the six requested modules in order', () => {
    expect(modules.map(({ id, index }) => [id, index])).toEqual([
      ['cell', 1],
      ['bravais', 2],
      ['packing', 3],
      ['coordination', 4],
      ['tetra', 5],
      ['octa', 6],
    ]);
  });

  it('removes density, carbon, optional frame controls and speed controls from data', () => {
    expect(modules.some(({ id }) => ['density', 'carbon'].includes(id))).toBe(false);
    expect(Object.keys(defaultSettings)).toEqual([
      'modelStyle',
      'showSupercell',
      'autoRotate',
      'exploded',
      'sectionView',
    ]);
    Object.values(crystals).forEach((info) => {
      expect(info).not.toHaveProperty('apf');
      expect(info).not.toHaveProperty('formula');
      expect(info).not.toHaveProperty('carbon');
    });
  });

  it('shows exact crystal parameters as radicals or fractions', () => {
    expect(crystals.FCC.latticeConstant).toBe('a = 1');
    expect(crystals.FCC.radius).toBe('R = √2a / 4');
    expect(crystals.BCC.latticeConstant).toBe('a = 1');
    expect(crystals.BCC.radius).toBe('R = √3a / 4');
    expect(crystals.HCP.latticeConstant).toBe('a = 1, c/a = √(8/3)');
    expect(crystals.HCP.radius).toBe('R = a / 2');
  });
});

describe('crystallographic geometry', () => {
  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s rigid nearest neighbors touch', (crystal) => {
    const geometry = latticeGeometry[crystal];
    expect(nearestDistance(crystal)).toBeCloseTo(2 * geometry.atomRadiusOverA * geometry.worldA, 5);
  });

  it('keeps ideal HCP c/a and a 120-degree tiling basis', () => {
    expect(hcpGeometry.c / hcpGeometry.a).toBeCloseTo(Math.sqrt(8 / 3), 8);
    const a = new THREE.Vector3(...hcpGeometry.tileVectorA);
    const b = new THREE.Vector3(...hcpGeometry.tileVectorB);
    expect(a.angleTo(b)).toBeCloseTo((2 * Math.PI) / 3, 8);
  });
});

describe('atom and bond visuals', () => {
  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s reference spheres keep the reference radius', (crystal) => {
    const ratio = crystal === 'HCP'
      ? atomVisualStyle.hcpSchematicRadiusOverA
      : atomVisualStyle.cubicSchematicRadiusOverA;
    expect(atomRenderRadius(crystal, 'schematic')).toBeCloseTo(ratio * latticeGeometry[crystal].worldA, 8);
  });

  it('uses the same displayed reference-sphere radius for FCC, BCC and HCP', () => {
    const fccRadius = atomRenderRadius('FCC', 'schematic');
    expect(atomRenderRadius('BCC', 'schematic')).toBeCloseTo(fccRadius, 8);
    expect(atomRenderRadius('HCP', 'schematic')).toBeCloseTo(fccRadius, 8);
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s ball-stick atoms are 60% of reference spheres', (crystal) => {
    expect(atomRenderRadius(crystal, 'ball-stick')).toBeCloseTo(
      atomRenderRadius(crystal, 'schematic') * 0.6,
      8,
    );
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s rigid atoms retain contact radius', (crystal) => {
    expect(atomRenderRadius(crystal, 'rigid')).toBeCloseTo(
      latticeGeometry[crystal].atomRadiusOverA * latticeGeometry[crystal].worldA,
      8,
    );
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s bonds contain unique nearest-neighbor pairs only', (crystal) => {
    const atoms = createAtoms(crystal, 2, false, 'cell');
    const pairs = nearestNeighborBondPairs(atoms, crystal);
    const expectedDistance = 2 * latticeGeometry[crystal].atomRadiusOverA * latticeGeometry[crystal].worldA;
    expect(pairs.length).toBeGreaterThan(0);
    expect(new Set(pairs.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`)).size).toBe(pairs.length);
    pairs.forEach(([a, b]) => {
      expect(atoms[a].position.distanceTo(atoms[b].position)).toBeCloseTo(expectedDistance, 5);
    });
  });

  it('keeps the reference material and fixed animation values', () => {
    expect(atomVisualStyle.baseColor).toBe('#38bdf8');
    expect(atomVisualStyle.specularColor).toBe('#888888');
    expect(atomVisualStyle.shininess).toBe(80);
    expect(atomVisualStyle.bondRadius).toBe(0.025);
    expect(defaultSettings.autoRotate).toBe(true);
    expect(AUTO_ROTATE_RADIANS_PER_FRAME).toBe(0.003);
  });
});

describe('independent Bravais lattice sites', () => {
  it.each([
    ['FCC', 14],
    ['BCC', 9],
    ['HCP', 14],
  ] as const)('%s conventional cell exposes %i unique lattice sites', (crystal, count) => {
    const sites = createBravaisSites(crystal, 1);
    expect(sites).toHaveLength(count);
    expect(new Set(sites.map((site) => positionKey(site.position))).size).toBe(count);
  });

  it('keeps the HCP basis out of the Bravais view', () => {
    expect(createBravaisSites('HCP', 1).some((site) => site.kind === 'center')).toBe(false);
  });

  it('renders Bravais sites as small position points instead of atom-sized spheres', () => {
    expect(bravaisPointStyle).toEqual({ color: '#7dd0ff', size: 0.095 });
    expect(bravaisPointStyle.size).toBeLessThan(atomRenderRadius('FCC', 'schematic') / 3);
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s 2x2x2 lattice expands without duplicate sites', (crystal) => {
    const single = createBravaisSites(crystal, 1);
    const repeated = createBravaisSites(crystal, 2);
    expect(repeated.length).toBeGreaterThan(single.length);
    expect(new Set(repeated.map((site) => positionKey(site.position))).size).toBe(repeated.length);
  });

  it('deduplicates shared boundary atoms', () => {
    const point = new THREE.Vector3(1, 2, 3);
    const atoms = deduplicateAtoms([
      { position: point.clone(), kind: 'base' },
      { position: point.clone(), kind: 'face' },
    ]);
    expect(atoms).toHaveLength(1);
  });
});

describe('interstitial topology and visuals', () => {
  it('uses fixed translucent base atoms in both gap modules', () => {
    expect(atomOpacityForModule('tetra')).toBe(0.42);
    expect(atomOpacityForModule('octa')).toBe(0.42);
    expect(atomOpacityForModule('cell')).toBe(1);
  });

  it('uses equal-size lit site spheres with stable colors', () => {
    expect(gapVisualStyle('tetra')).toEqual({ radius: 0.15, color: '#45d27a' });
    expect(gapVisualStyle('octa')).toEqual({ radius: 0.15, color: '#f39a42' });
  });

  it('keeps HCP site identifiers out of descriptive suffixes', () => {
    expect(getGapLabel('HCP', 'tetra', 0)).toBe('层间下指 [12/cell]');
    expect(getGapLabel('HCP', 'tetra', 1)).toBe('层间上指 [12/cell]');
    expect(getGapLabel('HCP', 'octa', 0)).toBe('层间八面体 [6/cell]');
  });

  it('builds tetrahedra with 6 edges and octahedra with 12', () => {
    const center = new THREE.Vector3();
    const tetra = [
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(1, -1, -1),
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(-1, -1, 1),
    ];
    const octa = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];
    expect(polyhedronEdges(tetra, center, 'tetra')).toHaveLength(6);
    expect(polyhedronEdges(octa, center, 'octa')).toHaveLength(12);
  });

  it.each([
    ['FCC', 'tetra', 4],
    ['FCC', 'octa', 6],
    ['BCC', 'tetra', 4],
    ['BCC', 'octa', 6],
    ['HCP', 'tetra', 4],
    ['HCP', 'octa', 6],
  ] as const)('%s %s site has %i unique surrounding atoms', (crystal, kind, count) => {
    const surrounding = findSurroundingAtoms(crystal, getGapPositions(crystal, kind)[0], kind);
    expect(surrounding).toHaveLength(count);
    expect(new Set(surrounding.map(positionKey)).size).toBe(count);
  });
});

describe('coordination shells', () => {
  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s waits for a click before highlighting a coordination center', (crystal) => {
    expect(createAtoms(crystal, 1, false, 'coordination').some((atom) => atom.highlight)).toBe(false);
  });

  it('uses yellow for the selected center and red for nearest neighbors', () => {
    expect(coordinationVisualStyle).toEqual({
      centerColor: '#fff65c',
      neighborColor: '#ff4f57',
      baseColor: '#38bdf8',
    });
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s expands to 2x2x2 frames only after a coordination click', (crystal) => {
    expect(cellFrameRepeat(crystal, 'coordination', false, false)).toBe(1);
    expect(cellFrameRepeat(crystal, 'coordination', true, false)).toBe(2);
    expect(cellFrameRepeat(crystal, 'cell', false, true)).toBe(2);
  });

  it.each([
    ['FCC', 12],
    ['BCC', 8],
    ['HCP', 12],
  ] as const)('%s retains a complete periodic nearest-neighbor shell', (crystal, count) => {
    const atoms = createAtoms(crystal, 1, false, 'coordination');
    const shell = coordinationShell(atoms, crystal, atoms[0].position);
    expect(shell?.nearest).toHaveLength(count);
    const distances = shell!.nearest.map((neighbor) => neighbor.distance);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(1e-5);
  });
});

describe('packing and camera presets', () => {
  it('defines three corners and three face centers on FCC {111}', () => {
    const sites = fcc111PackingSites();
    expect(sites.filter((site) => site.role === 'corner')).toHaveLength(3);
    expect(sites.filter((site) => site.role === 'face')).toHaveLength(3);
    sites.forEach(({ position }) => expect(position[0] + position[1] + position[2]).toBeCloseTo(1, 8));
  });

  it('runs the FCC <110> arrow through a {111} face-center atom', () => {
    const [start, end] = fcc110DirectionEndpoints();
    const midpoint = start.map((value, index) => (value + end[index]) / 2) as [number, number, number];
    expect(midpoint).toEqual([0.5, 0.5, 0]);
    expect(fcc111PackingSites()).toContainEqual({ position: midpoint, role: 'face' });
  });

  it('keeps the BCC <111> direction inside the {110} plane', () => {
    const [start, end] = bcc111DirectionEndpoints();
    expect(start).toEqual([0, 0, 0]);
    expect(end).toEqual([1, 1, 1]);
    expect(start[0] - start[1]).toBe(0);
    expect(end[0] - end[1]).toBe(0);
  });

  it('uses a thin packing vector with a legible arrow head for all structures', () => {
    expect(packingDirectionStyle).toEqual({ shaftRadius: 0.018, headLength: 0.34, headWidth: 0.19 });
    expect(packingDirectionStyle.headLength).toBeGreaterThan(packingDirectionStyle.shaftRadius * 10);
  });

  it('uses a short eased coordination transition for all structures', () => {
    expect(COORDINATION_TRANSITION_MS).toBe(450);
    expect(coordinationTransitionEase(0)).toBe(0);
    expect(coordinationTransitionEase(0.5)).toBeGreaterThan(0.5);
    expect(coordinationTransitionEase(1)).toBe(1);
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s uses global Z-up', (crystal) => {
    expect(cameraPreset(crystal, 1, 'cell').up).toEqual([0, 0, 1]);
  });

  it('keeps the FCC and BCC entry camera framing identical', () => {
    expect(cameraPreset('FCC', 1, 'cell')).toEqual(cameraPreset('BCC', 1, 'cell'));
  });

  it('uses the same normalized entry angle for FCC, BCC and HCP', () => {
    const normalizedPosition = (crystal: CrystalType) => new THREE.Vector3(...cameraPreset(crystal, 1, 'cell').position).normalize();
    const fcc = normalizedPosition('FCC');
    expect(normalizedPosition('BCC').distanceTo(fcc)).toBeLessThan(1e-8);
    expect(normalizedPosition('HCP').distanceTo(fcc)).toBeLessThan(1e-8);
  });

  it('retains the half-cell section plane through the origin', () => {
    expect(sectionClippingPlaneSpec()).toEqual({ normal: [1, 0, 0], constant: 0 });
  });
});
