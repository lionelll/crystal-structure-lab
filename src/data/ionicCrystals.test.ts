import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyCentering,
  ionicCoordinationShell,
  ionicCrystalOrder,
  ionicCrystals,
  ionicDefaultSupercell,
  isIonicCrystalId,
  resolveIonicCrystal,
  ionicModules,
  type IonicCrystalId,
} from './ionicCrystals';
import {
  centeredIonicPosition,
  createIonicBravaisPoints,
  createIonicVisualSites,
  ionicAtomRadius,
  ionicCameraPreset,
  WURTZITE_CAMERA_DIRECTION,
} from '../components/IonicCrystalCanvas';

const expectedCounts: Record<IonicCrystalId, Record<string, number>> = {
  cscl: { cs: 1, cl: 1 },
  nacl: { na: 4, cl: 4 },
  'zns-cubic': { zn: 4, s: 4 },
  'zns-hex': { zn: 2, s: 2 },
  caf2: { ca: 4, f: 8 },
  catio3: { ca: 1, ti: 1, o: 3 },
  'tio2-rutile': { ti: 2, o: 4 },
  'sio2-beta-cristobalite': { si: 8, o: 16 },
  mgal2o4: { mg: 8, al: 16, o: 32 },
};

describe('ionic crystal catalog', () => {
  it('keeps all nine requested structures in menu order with chemical subscripts', () => {
    expect(ionicCrystalOrder.map((id) => ionicCrystals[id].title)).toEqual([
      'CsCl型结构',
      'NaCl型结构',
      '立方ZnS型结构',
      '六方ZnS型结构',
      'CaF₂型结构',
      'CaTiO₃型结构',
      'TiO₂(金红石)型结构',
      'SiO₂(β-方石英)型结构',
      'MgAl₂O₄型结构',
    ]);
  });

  it('opens exactly the four ionic modules requested by the PRD', () => {
    expect(ionicModules.map((module) => module.id)).toEqual(['cell', 'bravais', 'coordination', 'ion-sites']);
  });

  it('opens only wurtzite with a teaching-oriented 2x2x2 default view', () => {
    expect(ionicDefaultSupercell('zns-hex')).toBe(true);
    ionicCrystalOrder
      .filter((id) => id !== 'zns-hex')
      .forEach((id) => expect(ionicDefaultSupercell(id)).toBe(false));
  });

  it('rejects invalid structure ids and falls back to CsCl data', () => {
    expect(isIonicCrystalId('nacl')).toBe(true);
    expect(isIonicCrystalId('')).toBe(false);
    expect(isIonicCrystalId('unknown')).toBe(false);
    expect(resolveIonicCrystal('')).toBe(ionicCrystals.cscl);
    expect(resolveIonicCrystal('unknown')).toBe(ionicCrystals.cscl);
    expect(resolveIonicCrystal(undefined)).toBe(ionicCrystals.cscl);
  });

  it.each(ionicCrystalOrder)('%s has the correct effective conventional-cell composition', (id) => {
    const counts = ionicCrystals[id].sites.reduce<Record<string, number>>((result, site) => {
      result[site.speciesId] = (result[site.speciesId] ?? 0) + 1;
      return result;
    }, {});
    expect(counts).toEqual(expectedCounts[id]);
  });

  it.each(ionicCrystalOrder)('%s supplies every fixed right-panel field and teaching text', (id) => {
    const crystal = ionicCrystals[id];
    expect([
      crystal.structureType,
      crystal.latticeType,
      crystal.ionPositions,
      crystal.ionCounts,
      crystal.coordinationText,
      crystal.basis,
      crystal.teaching,
    ].every((value) => value.trim().length > 0)).toBe(true);
  });
});

describe('ionic lattice geometry', () => {
  it('applies F centering without duplicate species positions', () => {
    const centered = applyCentering(
      [{ speciesId: 'x', fractional: [0, 0, 0] }],
      [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]],
    );
    expect(centered).toHaveLength(4);
    expect(new Set(centered.map((site) => site.fractional.join('|'))).size).toBe(4);
  });

  it.each(ionicCrystalOrder)('%s renders periodic boundary images without duplicate ion positions', (id) => {
    const visualSites = createIonicVisualSites(ionicCrystals[id], 1);
    const keys = visualSites.map((site) => `${site.speciesId}|${site.position.toArray().map((value) => value.toFixed(6)).join('|')}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(visualSites.length).toBeGreaterThanOrEqual(ionicCrystals[id].sites.length);
  });

  it('renders an independent point lattice rather than structure ions', () => {
    expect(createIonicBravaisPoints(ionicCrystals.cscl, 1)).toHaveLength(8);
    expect(createIonicBravaisPoints(ionicCrystals.nacl, 1)).toHaveLength(14);
    expect(createIonicBravaisPoints(ionicCrystals['zns-cubic'], 1)).toHaveLength(14);
  });

  it('reduces only the visual radius of high-site-count cells', () => {
    expect(ionicAtomRadius(ionicCrystals.cscl, 0.3)).toBe(0.3);
    expect(ionicAtomRadius(ionicCrystals['sio2-beta-cristobalite'], 0.3)).toBeCloseTo(0.234, 8);
    expect(ionicAtomRadius(ionicCrystals.mgal2o4, 0.3)).toBeCloseTo(0.204, 8);
  });

  it.each([
    ['cscl', 'cs'],
    ['nacl', 'na'],
  ] as const)('%s default camera keeps the body-center ion clear of foreground corner ions', (id, centerSpeciesId) => {
    const crystal = ionicCrystals[id];
    const camera = new THREE.Vector3(...ionicCameraPreset(crystal, 1).position);
    const centerSite = crystal.sites.find((site) => site.speciesId === centerSpeciesId
      && site.fractional.every((value) => Math.abs(value - 0.5) < 1e-8));
    expect(centerSite).toBeDefined();
    const center = centeredIonicPosition(crystal, centerSite!.fractional, 1);
    const centerSpecies = crystal.species.find((item) => item.id === centerSpeciesId)!;
    const cornerSpecies = crystal.species.find((item) => item.id === 'cl')!;
    const corners = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => (
      centeredIonicPosition(crystal, [x, y, z], 1)
    ))));
    const foregroundCorners = corners.filter((corner) => corner.distanceTo(camera) < center.distanceTo(camera));
    expect(foregroundCorners.length).toBeGreaterThan(0);

    foregroundCorners.forEach((corner) => {
      const centerRay = center.clone().sub(camera);
      const cornerRay = corner.clone().sub(camera);
      const angularSeparation = centerRay.angleTo(cornerRay);
      const projectedRadii = Math.asin(ionicAtomRadius(crystal, centerSpecies.radius) / centerRay.length())
        + Math.asin(ionicAtomRadius(crystal, cornerSpecies.radius) / cornerRay.length());
      expect(angularSeparation).toBeGreaterThan(projectedRadii);
    });
  });

  it('keeps the wurtzite camera clear of every basal lattice direction', () => {
    const view = new THREE.Vector2(WURTZITE_CAMERA_DIRECTION[0], WURTZITE_CAMERA_DIRECTION[1]).normalize();
    const basalDirections = [
      new THREE.Vector2(1, 0),
      new THREE.Vector2(-0.5, Math.sqrt(3) / 2),
      new THREE.Vector2(0.5, Math.sqrt(3) / 2),
      new THREE.Vector2(1.5, -Math.sqrt(3) / 2),
    ];
    basalDirections.forEach((direction) => {
      const alignment = Math.abs(view.dot(direction.normalize()));
      expect(alignment).toBeLessThan(Math.cos(THREE.MathUtils.degToRad(20)));
    });
  });
});

describe('ionic coordination topology', () => {
  it.each(ionicCrystalOrder)('%s returns each species requested coordination number', (id) => {
    const crystal = ionicCrystals[id];
    crystal.species.forEach((species) => {
      const siteIndex = crystal.sites.findIndex((site) => site.speciesId === species.id);
      const center = { siteIndex, fractional: crystal.sites[siteIndex].fractional };
      expect(ionicCoordinationShell(crystal, center)).toHaveLength(species.coordination);
    });
  });

  it('keeps the perovskite Ti ion inside an O6 octahedron', () => {
    const crystal = ionicCrystals.catio3;
    const siteIndex = crystal.sites.findIndex((site) => site.speciesId === 'ti');
    const shell = ionicCoordinationShell(crystal, { siteIndex, fractional: crystal.sites[siteIndex].fractional });
    expect(shell).toHaveLength(6);
    expect(new Set(shell.map((neighbor) => neighbor.speciesId))).toEqual(new Set(['o']));
    shell.forEach((neighbor) => expect(neighbor.distance).toBeCloseTo(shell[0].distance, 8));
  });

  it('keeps fluorite Ca and F coordination at 8 and 4', () => {
    const crystal = ionicCrystals.caf2;
    crystal.species.forEach((species) => {
      const siteIndex = crystal.sites.findIndex((site) => site.speciesId === species.id);
      const shell = ionicCoordinationShell(crystal, { siteIndex, fractional: crystal.sites[siteIndex].fractional });
      expect(shell).toHaveLength(species.id === 'ca' ? 8 : 4);
    });
  });

  it('uses one Mg and three Al neighbors around spinel oxygen', () => {
    const crystal = ionicCrystals.mgal2o4;
    const siteIndex = crystal.sites.findIndex((site) => site.speciesId === 'o');
    const shell = ionicCoordinationShell(crystal, { siteIndex, fractional: crystal.sites[siteIndex].fractional });
    const composition = shell.reduce<Record<string, number>>((result, neighbor) => {
      result[neighbor.speciesId] = (result[neighbor.speciesId] ?? 0) + 1;
      return result;
    }, {});
    expect(composition).toEqual({ mg: 1, al: 3 });
  });
});
