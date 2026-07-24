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
  applyDefaultIonicIonVisual,
  applyIonicIonSiteVisual,
  centeredIonicPosition,
  createIonicBravaisPoints,
  createIonicIonMaterial,
  createIonicVisualSites,
  createWurtziteHexPrismFrameSegments,
  createWurtziteHexPrismVisualSites,
  ionicAtomRadius,
  ionicCameraPreset,
  ionicIonSiteVisualState,
  nextIonicSpeciesSelection,
  ION_SITE_MUTED_COLOR_FACTOR,
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
  'sio2-beta-cristobalite': { si: 8, o: 16 },
  mgal2o4: { mg: 8, al: 16, o: 32 },
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
      'SiO₂(β-方石英)型结构',
      'MgAl₂O₄型结构',
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
    expect(isIonicCrystalId('sio2-beta-cristobalite')).toBe(true);
    expect(isIonicCrystalId('mgal2o4')).toBe(true);
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
    expect(ION_SITE_MUTED_OPACITY).toBe(0.16);
    expect(ION_SITE_MUTED_COLOR_FACTOR).toBe(0.35);
    ionicCrystalOrder.forEach(() => {
      expect(ionicIonSiteVisualState(false)).toEqual({
        transparent: true,
        opacity: 0.16,
        depthWrite: true,
        depthTest: true,
        emissiveIntensity: 0,
        colorFactor: 0.35,
        renderOrder: 1,
        scale: 1,
      });
    });
  });

  it('keeps repeated ion-site clicks selected instead of toggling the filter off', () => {
    expect(nextIonicSpeciesSelection(null, 'zn')).toBe('zn');
    expect(nextIonicSpeciesSelection('zn', 'zn')).toBe('zn');
    expect(nextIonicSpeciesSelection('zn', 's')).toBe('s');
  });

  it.each(ionicCrystalOrder)('%s applies the same ion-site material states to every species', (id) => {
    const crystal = ionicCrystals[id];
    crystal.species.forEach((selectedIon) => {
      crystal.species.forEach((ion) => {
        const material = new THREE.MeshPhongMaterial({ color: ion.color, emissive: ion.color });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2), material);
        const initialVersion = material.version;
        const selected = ion.id === selectedIon.id;

        applyIonicIonSiteVisual(mesh, ion.color, selected);

        expect(material.opacity).toBe(selected ? 1 : ION_SITE_MUTED_OPACITY);
        expect(material.transparent).toBe(!selected);
        expect(material.depthWrite).toBe(true);
        expect(material.depthTest).toBe(true);
        expect(material.emissiveIntensity).toBe(selected ? 0.22 : 0);
        expect(mesh.renderOrder).toBe(selected ? 2 : 1);
        expect(mesh.scale.x).toBe(1);
        const originalColor = new THREE.Color(ion.color);
        expect(material.color.r).toBeCloseTo(originalColor.r * (selected ? 1 : ION_SITE_MUTED_COLOR_FACTOR));
        expect(material.color.g).toBeCloseTo(originalColor.g * (selected ? 1 : ION_SITE_MUTED_COLOR_FACTOR));
        expect(material.color.b).toBeCloseTo(originalColor.b * (selected ? 1 : ION_SITE_MUTED_COLOR_FACTOR));
        if (!selected) expect(material.version).toBeGreaterThan(initialVersion);

        mesh.geometry.dispose();
        material.dispose();
      });
    });
  });

  it('refreshes the material pipeline when a species changes between selected and muted', () => {
    const material = new THREE.MeshPhongMaterial({ color: '#38bdf8', emissive: '#38bdf8' });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2), material);

    applyIonicIonSiteVisual(mesh, '#38bdf8', false);
    const mutedVersion = material.version;
    applyIonicIonSiteVisual(mesh, '#38bdf8', true);

    expect(material.version).toBeGreaterThan(mutedVersion);
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.color.getHexString()).toBe(new THREE.Color('#38bdf8').getHexString());

    mesh.geometry.dispose();
    material.dispose();
  });

  it('creates an independent material instance for every ion mesh', () => {
    const first = createIonicIonMaterial('#38bdf8');
    const second = createIonicIonMaterial('#38bdf8');

    expect(first).not.toBe(second);
    first.transparent = true;
    first.opacity = 0.16;
    expect(second.transparent).toBe(false);
    expect(second.opacity).toBe(1);

    first.dispose();
    second.dispose();
  });

  it('restores an ion material without leaving the transparent render path active', () => {
    const material = createIonicIonMaterial('#38bdf8');
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2), material);
    applyIonicIonSiteVisual(mesh, '#38bdf8', false);
    const mutedVersion = material.version;

    applyDefaultIonicIonVisual(mesh, '#38bdf8');

    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.depthWrite).toBe(true);
    expect(material.version).toBeGreaterThan(mutedVersion);

    mesh.geometry.dispose();
    material.dispose();
  });

  it('uses the measured wurtzite ratio and ideal internal parameter with tetrahedral neighbors', () => {
    const crystal = ionicCrystals['zns-hex'];
    expect(WURTZITE_C_OVER_A).toBeCloseTo(1.63777, 5);
    expect(WURTZITE_U).toBe(3 / 8);
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

  it('renders the wurtzite display cell as three primitive cells in a full hexagonal prism', () => {
    const crystal = ionicCrystals['zns-hex'];
    const sites = createWurtziteHexPrismVisualSites(crystal, 1);
    const bySpecies = (speciesId: string) => sites.filter((site) => site.speciesId === speciesId);
    const sulfurSites = bySpecies('s');
    const zincSites = bySpecies('zn');
    const effectiveCount = (speciesId: string) => bySpecies(speciesId)
      .reduce((total, site) => total + (site.displayWeight ?? 1), 0);
    const layerCounts = (layerSites: typeof sites) => Object.values(
      layerSites.reduce<Record<string, number>>((counts, site) => {
        const key = site.position.z.toFixed(6);
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    ).sort((left, right) => left - right);

    expect(sulfurSites).toHaveLength(17);
    expect(zincSites).toHaveLength(10);
    expect(layerCounts(sulfurSites)).toEqual([3, 7, 7]);
    expect(layerCounts(zincSites)).toEqual([3, 7]);
    expect(effectiveCount('s')).toBeCloseTo(6, 8);
    expect(effectiveCount('zn')).toBeCloseTo(6, 8);
    expect(createWurtziteHexPrismFrameSegments(crystal, 1)).toHaveLength(43);
    expect(createIonicBravaisPoints(crystal, 1)).toHaveLength(14);

    const supercellSites = createWurtziteHexPrismVisualSites(crystal, 2);
    crystal.species.forEach((species) => {
      const effectiveSupercellCount = supercellSites
        .filter((site) => site.speciesId === species.id)
        .reduce((total, site) => total + (site.displayWeight ?? 1), 0);
      expect(effectiveSupercellCount).toBeCloseTo(48, 8);
    });
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

  it('shows each perovskite oxygen coordinated by two Ti and four Ca ions', () => {
    const crystal = ionicCrystals.catio3;
    crystal.sites.forEach((site, siteIndex) => {
      if (site.speciesId !== 'o') return;
      const shell = ionicCoordinationShell(crystal, { siteIndex, fractional: site.fractional });
      const speciesCounts = shell.reduce<Record<string, number>>((counts, neighbor) => {
        counts[neighbor.speciesId] = (counts[neighbor.speciesId] ?? 0) + 1;
        return counts;
      }, {});

      expect(shell).toHaveLength(6);
      expect(speciesCounts).toEqual({ ti: 2, ca: 4 });
    });
    expect(crystal.coordinationText).toContain('O²⁻：6（2Ti⁴⁺+4Ca²⁺）');
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
