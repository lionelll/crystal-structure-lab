import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AUTO_ROTATE_RADIANS_PER_FRAME,
  addGapTargets,
  applyCoordinationAtomVisuals,
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
  createStackingAtoms,
  createAtoms,
  createBravaisSites,
  deduplicateAtoms,
  fcc110DirectionEndpoints,
  fcc111PackingSites,
  findSurroundingAtoms,
  gapVisualStyle,
  getGapLabel,
  getGapPositions,
  crystalAxisVectors,
  missingPeriodicGapNeighbors,
  packingPlaneColor,
  packingDirectionStyle,
  polyhedronEdges,
  renderGapSelectionLayer,
  sceneStructureKey,
  stackingAtomRadius,
  stackingPositionScale,
  stackingSequence,
} from './CrystalCanvas';
import { crystals, defaultSettings, isCrystalType, modules, resolveCrystal } from '../data/crystals';
import {
  hcpGeometry,
  latticeGeometry,
  type CrystalType,
} from '../data/latticeGeometry';

function positionKey(point: THREE.Vector3) {
  return point.toArray().map((value) => value.toFixed(6)).join(',');
}

function renderPositionKey(point: THREE.Vector3) {
  return point.toArray().map((coordinate) => Math.round(coordinate * 1000)).join(',');
}

function nearestDistance(crystal: CrystalType) {
  const atoms = createAtoms(crystal, 1, 'cell').map((atom) => atom.position);
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
  it('keeps the seven requested modules in order', () => {
    expect(modules.map(({ id, index }) => [id, index])).toEqual([
      ['cell', 1],
      ['stacking', 2],
      ['bravais', 3],
      ['packing', 4],
      ['coordination', 5],
      ['tetra', 6],
      ['octa', 7],
    ]);
  });

  it('removes unused display modes, density, carbon, optional frame controls and speed controls from data', () => {
    expect(modules.some(({ id }) => ['density', 'carbon'].includes(id))).toBe(false);
    expect(Object.keys(defaultSettings)).toEqual(['showSupercell', 'autoRotate']);
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

  it('rejects invalid metal crystal ids and falls back to FCC data', () => {
    expect(isCrystalType('BCC')).toBe(true);
    expect(isCrystalType('')).toBe(false);
    expect(isCrystalType('unknown')).toBe(false);
    expect(resolveCrystal('')).toBe(crystals.FCC);
    expect(resolveCrystal('unknown')).toBe(crystals.FCC);
    expect(resolveCrystal(undefined)).toBe(crystals.FCC);
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
    expect(atomRenderRadius(crystal)).toBeCloseTo(ratio * latticeGeometry[crystal].worldA, 8);
  });

  it('uses the same displayed reference-sphere radius for FCC, BCC and HCP', () => {
    const fccRadius = atomRenderRadius('FCC');
    expect(atomRenderRadius('BCC')).toBeCloseTo(fccRadius, 8);
    expect(atomRenderRadius('HCP')).toBeCloseTo(fccRadius, 8);
  });

  it('keeps the reference material and fixed animation values', () => {
    expect(atomVisualStyle.baseColor).toBe('#38bdf8');
    expect(atomVisualStyle.specularColor).toBe('#888888');
    expect(atomVisualStyle.shininess).toBe(80);
    expect(defaultSettings.autoRotate).toBe(true);
    expect(AUTO_ROTATE_RADIANS_PER_FRAME).toBe(0.0015);
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
    expect(bravaisPointStyle.size).toBeLessThan(atomRenderRadius('FCC') / 3);
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

  it.each([
    ['FCC', 'tetra'],
    ['FCC', 'octa'],
    ['BCC', 'tetra'],
    ['BCC', 'octa'],
    ['HCP', 'tetra'],
    ['HCP', 'octa'],
  ] as const)('%s %s 2x2x2 cage endpoints match rendered atom centers', (crystal, kind) => {
    const atoms = createAtoms(crystal, 2, kind);
    const sites = getGapPositions(crystal, kind, 2);
    const renderedKeys = new Set(atoms.map((atom) => positionKey(atom.position)));
    expect(sites.length).toBeGreaterThan(getGapPositions(crystal, kind, 1).length);
    const surrounding = findSurroundingAtoms(crystal, sites[0], kind, atoms);
    expect(surrounding).toHaveLength(kind === 'tetra' ? 4 : 6);
    surrounding.forEach((position) => expect(renderedKeys.has(positionKey(position))).toBe(true));
  });

  it.each([
    ['FCC', 'tetra'],
    ['FCC', 'octa'],
    ['BCC', 'tetra'],
    ['BCC', 'octa'],
    ['HCP', 'tetra'],
    ['HCP', 'octa'],
  ] as const)('%s %s uses the correct periodic coordination geometry for every displayed site', (crystal, kind) => {
    [1, 2].forEach((repeat) => {
      const atoms = createAtoms(crystal, repeat, kind);
      getGapPositions(crystal, kind, repeat).forEach((site) => {
        const surrounding = findSurroundingAtoms(crystal, site, kind, atoms, repeat);
        const distances = surrounding.map((position) => position.distanceTo(site)).sort((a, b) => a - b);
        expect(surrounding).toHaveLength(kind === 'tetra' ? 4 : 6);
        expect(new Set(surrounding.map(positionKey)).size).toBe(surrounding.length);
        if (crystal === 'BCC' && kind === 'octa') {
          expect(distances[1]).toBeCloseTo(distances[0], 6);
          expect(distances[2]).toBeGreaterThan(distances[1]);
          expect(distances[5]).toBeCloseTo(distances[2], 6);
        } else {
          expect(distances[distances.length - 1] - distances[0]).toBeLessThan(1e-5);
        }
      });
    });
  });

  it('adds only missing periodic atoms to a selected boundary cage', () => {
    const crystal: CrystalType = 'FCC';
    const kind = 'octa' as const;
    const atoms = createAtoms(crystal, 1, kind);
    const renderedKeys = new Set(atoms.map((atom) => renderPositionKey(atom.position)));
    const site = getGapPositions(crystal, kind).find((position) => Math.abs(position.y + latticeGeometry.FCC.worldA / 2) < 1e-6)!;
    const surrounding = findSurroundingAtoms(crystal, site, kind, atoms, 1);
    const missing = missingPeriodicGapNeighbors(surrounding, renderedKeys);
    const layer = new THREE.Group();

    renderGapSelectionLayer(
      layer,
      crystal,
      kind,
      [site],
      atoms,
      0,
      1,
      atomRenderRadius(crystal),
      renderedKeys,
    );

    const periodicMeshes = layer.children.filter((child) => child.userData.kind === 'periodic-gap-neighbor');
    expect(periodicMeshes).toHaveLength(missing.length);
    expect(new Set(periodicMeshes.map((mesh) => renderPositionKey(mesh.position)))).toEqual(
      new Set(missing.map(renderPositionKey)),
    );
    periodicMeshes.forEach((mesh) => expect(renderedKeys.has(renderPositionKey(mesh.position))).toBe(false));
  });

  it('keeps FCC 2x2x2 octahedral sites separate from matrix atoms', () => {
    const atoms = createAtoms('FCC', 2, 'octa').map((atom) => atom.position);
    getGapPositions('FCC', 'octa', 2).forEach((site) => {
      expect(Math.min(...atoms.map((atom) => atom.distanceTo(site)))).toBeGreaterThan(1e-5);
    });
  });
});

describe('selection layer continuity', () => {
  it.each([
    ['tetra', 4],
    ['octa', 6],
  ] as const)('updates only the FCC %s selection cage with %i connectors', (kind, connectorCount) => {
    const root = new THREE.Group();
    const selectionLayer = new THREE.Group();
    const pickables: THREE.Object3D[] = [];
    const atoms = createAtoms('FCC', 1, kind);
    const { positions, meshes } = addGapTargets(root, 'FCC', kind, 1, pickables);
    root.add(selectionLayer);
    const originalTargets = [...meshes];
    root.rotation.z = 0.73;

    expect(renderGapSelectionLayer(selectionLayer, 'FCC', kind, positions, atoms, 0)).toBe(connectorCount);
    expect(renderGapSelectionLayer(selectionLayer, 'FCC', kind, positions, atoms, 1)).toBe(connectorCount);
    expect(root.rotation.z).toBeCloseTo(0.73, 8);
    expect(meshes).toEqual(originalTargets);
    originalTargets.forEach((mesh) => expect(mesh.parent).toBe(root));
  });

  it('reuses coordination atom meshes while applying a new periodic shell', () => {
    const root = new THREE.Group();
    const atoms = createAtoms('FCC', 1, 'coordination');
    const atomMeshes = new Map<string, THREE.Mesh>();
    atoms.forEach((atom) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2),
        new THREE.MeshPhongMaterial({ color: coordinationVisualStyle.baseColor }),
      );
      mesh.position.copy(atom.position);
      root.add(mesh);
      atomMeshes.set(renderPositionKey(atom.position), mesh);
    });
    const originalMeshes = [...atomMeshes.values()];
    const firstShell = coordinationShell(atoms, 'FCC', atoms[0].position)!;
    root.rotation.z = 1.17;

    applyCoordinationAtomVisuals(atomMeshes, firstShell);
    expect((atomMeshes.get(renderPositionKey(firstShell.center))!.material as THREE.MeshPhongMaterial).color.getHexString()).toBe('fff65c');
    expect([...atomMeshes.values()].some((mesh) => (
      mesh.material as THREE.MeshPhongMaterial
    ).color.getHexString() === 'ff4f57')).toBe(true);

    const secondShell = coordinationShell(atoms, 'FCC', atoms[atoms.length - 1].position)!;
    applyCoordinationAtomVisuals(atomMeshes, secondShell);
    expect(root.rotation.z).toBeCloseTo(1.17, 8);
    expect([...atomMeshes.values()]).toEqual(originalMeshes);
    originalMeshes.forEach((mesh) => expect(mesh.parent).toBe(root));
  });

  it('does not rebuild the scene when only auto rotation changes', () => {
    const rotating = { ...defaultSettings, autoRotate: true };
    const paused = { ...defaultSettings, autoRotate: false };
    expect(sceneStructureKey('FCC', 'tetra', rotating)).toBe(sceneStructureKey('FCC', 'tetra', paused));
    expect(sceneStructureKey('FCC', 'tetra', rotating)).not.toBe(sceneStructureKey('FCC', 'octa', rotating));
  });
});

describe('stacking models', () => {
  it('uses ABC stacking for FCC and AB stacking for BCC/HCP', () => {
    expect(stackingSequence('FCC')).toEqual(['A', 'B', 'C', 'A']);
    expect(stackingSequence('BCC')).toEqual(['A', 'B', 'A']);
    expect(stackingSequence('HCP')).toEqual(['A', 'B', 'A']);
  });

  it.each([
    ['FCC', 4],
    ['BCC', 3],
    ['HCP', 3],
  ] as const)('%s uses one conventional cell across %i stacking layers', (crystal, layerCount) => {
    const atoms = createStackingAtoms(crystal);
    expect(atoms).toHaveLength(createAtoms(crystal, 1, 'cell').length);
    const layerCoordinates = atoms.map(({ position }) => (
      crystal === 'FCC' ? position.x + position.y + position.z : position.z
    ));
    expect(new Set(layerCoordinates.map((coordinate) => coordinate.toFixed(6))).size).toBe(layerCount);
    stackingSequence(crystal).forEach((layer) => {
      expect(atoms.some((atom) => atom.layer === layer)).toBe(true);
    });
    expect(cellFrameRepeat(crystal, 'stacking', false, true)).toBe(1);
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s keeps the same camera scale as the cell model', (crystal) => {
    const stacking = cameraPreset(crystal, 1, 'stacking');
    const cell = cameraPreset(crystal, 1, 'cell');
    expect(stacking.position).toEqual(cell.position);
    expect(stacking.target).toEqual(cell.target);
  });

  it('uses the same displayed sphere radius as the cell model for all structures', () => {
    const expected = atomRenderRadius('FCC');
    (['FCC', 'BCC', 'HCP'] as CrystalType[]).forEach((crystal) => {
      expect(stackingAtomRadius(crystal)).toBeCloseTo(expected, 8);
      expect(stackingAtomRadius(crystal)).toBeCloseTo(atomRenderRadius(crystal), 8);
    });
  });

  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s rescales positions so equal-size spheres remain tangent', (crystal) => {
    const atoms = createStackingAtoms(crystal);
    const radius = stackingAtomRadius(crystal);
    const expectedDistance = 2 * radius;
    expect(stackingPositionScale(crystal)).toBeCloseTo(
      radius / (latticeGeometry[crystal].atomRadiusOverA * latticeGeometry[crystal].worldA),
      8,
    );
    atoms.forEach((atom, atomIndex) => {
      const nearest = Math.min(...atoms
        .filter((_, candidateIndex) => candidateIndex !== atomIndex)
        .map((candidate) => atom.position.distanceTo(candidate.position)));
      expect(nearest).toBeCloseTo(expectedDistance, 6);
    });
  });

  it('keeps the FCC stacking model in the same orientation as its cell model', () => {
    const cellAtoms = createAtoms('FCC', 1, 'cell');
    const stackingAtoms = createStackingAtoms('FCC');
    const scale = stackingPositionScale('FCC');
    stackingAtoms.forEach((atom, index) => {
      expect(atom.position.distanceTo(cellAtoms[index].position.clone().multiplyScalar(scale))).toBeLessThan(1e-8);
    });
  });

  it('explains BCC and HCP ABAB stacking without treating BCC as close-packed', () => {
    expect(crystals.BCC.stacking).toContain('ABAB…');
    expect(crystals.BCC.stacking).toContain('不是密排结构');
    expect(crystals.HCP.stacking).toContain('ABAB…');
    expect(crystals.HCP.stacking).toContain('{0001}');
  });
});

describe('coordination shells', () => {
  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s waits for a click before highlighting a coordination center', (crystal) => {
    expect(createAtoms(crystal, 1, 'coordination').some((atom) => atom.highlight)).toBe(false);
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
    const atoms = createAtoms(crystal, 1, 'coordination');
    const shell = coordinationShell(atoms, crystal, atoms[0].position);
    expect(shell?.nearest).toHaveLength(count);
    const distances = shell!.nearest.map((neighbor) => neighbor.distance);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(1e-5);
  });
});

describe('packing and camera presets', () => {
  it('uses the FCC blue for every packing plane', () => {
    expect(packingPlaneColor).toBe('#3B82F6');
  });

  it('uses three 120-degree basal axes and a vertical c-axis for HCP', () => {
    const axes = crystalAxisVectors('HCP');
    const basal = axes.slice(0, 3).map(({ direction }) => new THREE.Vector3(...direction).normalize());
    expect(axes.map(({ label }) => label)).toEqual(['a₁', 'a₂', 'a₃', 'c']);
    basal.forEach((axis) => expect(axis.z).toBeCloseTo(0, 8));
    expect(basal[0].angleTo(basal[1])).toBeCloseTo((2 * Math.PI) / 3, 8);
    expect(basal[1].angleTo(basal[2])).toBeCloseTo((2 * Math.PI) / 3, 8);
    expect(basal[2].angleTo(basal[0])).toBeCloseTo((2 * Math.PI) / 3, 8);
    expect(axes[3].direction).toEqual([0, 0, 1]);
  });
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

});
