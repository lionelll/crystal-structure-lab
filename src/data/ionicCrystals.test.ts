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
  WURTZITE_C_OVER_A,
  WURTZITE_U,
  type IonicCrystalId,
} from './ionicCrystals';
import {
  centeredIonicPosition,
  createIonicBravaisPoints,
  createIonicVisualSites,
  ionicAtomRadius,
  ionicCameraPreset,
  ION_SITE_MUTED_OPACITY,
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
};

describe('ionic crystal catalog', () => {
  it('keeps the seven supported structures in menu order with chemical subscripts', () => {
    expect(ionicCrystalOrder.map((id) => ionicCrystals[id].title)).toEqual([
      'CsCl型结构',
      'NaCl型结构',
      '立方ZnS型结构',
      '六方ZnS型结构',
      'CaF₂型结构',
      'CaTiO₃型结构',
      'TiO₂(金红石)型结构',
    ]);
  });

  it('opens exactly the four ionic modules requested by the PRD', () => {
    expect(ionicModules.map((module) => module.id)).toEqual(['cell', 'bravais', 'coordination', 'ion-sites']);
  });

  it('opens every ionic structure as a single cell by default', () => {
    ionicCrystalOrder.forEach((id) => expect(ionicDefaultSupercell(id)).toBe(false));
  });

  it('rejects invalid structure ids and falls back to CsCl data', () => {
    expect(isIonicCrystalId('nacl')).toBe(true);
    expect(isIonicCrystalId('')).toBe(false);
    expect(isIonicCrystalId('unknown')).toBe(false);
    expect(isIonicCrystalId('sio2-beta-cristobalite')).toBe(false);
    expect(isIonicCrystalId('mgal2o4')).toBe(false);
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
    expect(crystal.structureType).not.toMatch(/[cht][PIFR]\d+/);
    expect(crystal.ionCounts.split('；').every((item) => item.includes('：'))).toBe(true);
    expect(crystal.basisIons.length).toBeGreaterThan(0);
    crystal.basisIons.forEach((item) => {
      expect(crystal.species.some((species) => species.id === item.speciesId)).toBe(true);
      expect(item.count).toBeGreaterThan(0);
    });
  });

  it.each(ionicCrystalOrder)('%s keeps its basis diagram consistent with lattice sites', (id) => {
    const crystal = ionicCrystals[id];
    const latticePointCount = crystal.latticePoints.length;
    const basisIonCounts = Object.fromEntries(
      crystal.basisIons.map((item) => [item.speciesId, item.count]),
    );
    const siteCounts = crystal.sites.reduce<Record<string, number>>((counts, site) => {
      counts[site.speciesId] = (counts[site.speciesId] ?? 0) + 1;
      return counts;
    }, {});

    expect(crystal.sites.length % latticePointCount).toBe(0);
    expect(crystal.basisIons.reduce((total, item) => total + item.count, 0))
      .toBe(crystal.sites.length / latticePointCount);
    crystal.species.forEach((species) => {
      expect(siteCounts[species.id] % latticePointCount).toBe(0);
      expect(basisIonCounts[species.id]).toBe(siteCounts[species.id] / latticePointCount);
    });
  });

  it('uses the requested concise teaching copy', () => {
    expect(ionicCrystals['zns-cubic'].teaching).not.toContain('沿 ⟨111⟩');
    expect(ionicCrystals.catio3.teaching).not.toContain('本页采用理想立方');
    expect(ionicCrystals.catio3.teaching).not.toContain('实际室温');
    expect(ionicCrystals['tio2-rutile'].teaching).not.toContain('八面体沿 c 轴');
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

  it('keeps Ca slightly smaller than F and O in the requested models', () => {
    const caF2 = ionicCrystals.caf2;
    expect(caF2.species.find((item) => item.id === 'ca')!.radius)
      .toBeLessThan(caF2.species.find((item) => item.id === 'f')!.radius);
    const perovskite = ionicCrystals.catio3;
    expect(perovskite.species.find((item) => item.id === 'ca')!.radius)
      .toBeLessThan(perovskite.species.find((item) => item.id === 'o')!.radius);
    expect(ionicAtomRadius(caF2, 0.3)).toBe(0.3);
  });

  it('uses one shared muted opacity for every ion-site selection', () => {
    expect(ION_SITE_MUTED_OPACITY).toBe(0.14);
  });

  it('uses the measured wurtzite ratio and internal parameter with tetrahedral neighbors', () => {
    const crystal = ionicCrystals['zns-hex'];
    expect(WURTZITE_C_OVER_A).toBeCloseTo(1.63777, 5);
    expect(WURTZITE_U).toBeCloseTo(0.3748, 6);
    const zincIndex = crystal.sites.findIndex((site) => site.speciesId === 'zn');
    const shell = ionicCoordinationShell(crystal, {
      siteIndex: zincIndex,
      fractional: crystal.sites[zincIndex].fractional,
    });
    expect(shell).toHaveLength(4);
    expect(new Set(shell.map((neighbor) => neighbor.speciesId))).toEqual(new Set(['s']));
    expect(Math.max(...shell.map((neighbor) => neighbor.distance))
      - Math.min(...shell.map((neighbor) => neighbor.distance))).toBeLessThan(0.01);
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

});
