import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  carbonStatus,
  coordinationShell,
  createAtoms,
  fcc110DirectionEndpoints,
  fcc111PackingSites,
  findSurroundingAtoms,
  getGapPositions,
  polyhedronEdges,
} from './CrystalCanvas';
import { hcpGeometry, latticeGeometry, type CrystalType } from '../data/latticeGeometry';

function uniquePositions(points: THREE.Vector3[]) {
  return new Map(points.map((point) => [point.toArray().map((value) => value.toFixed(6)).join(','), point])).values();
}

function nearestDistance(crystal: CrystalType) {
  const atoms = [...uniquePositions(createAtoms(crystal, 1, false, 'cell').map((atom) => atom.position))];
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const distance = atoms[i].distanceTo(atoms[j]);
      if (distance > 1e-6) nearest = Math.min(nearest, distance);
    }
  }
  return nearest;
}

describe('rigid-sphere geometry', () => {
  it.each(['FCC', 'BCC', 'HCP'] as CrystalType[])('%s nearest neighbors touch', (crystal) => {
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

describe('interstitial topology', () => {
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
    const gap = getGapPositions(crystal, kind)[0];
    const surrounding = findSurroundingAtoms(crystal, gap, kind);
    expect(surrounding).toHaveLength(count);
    expect([...uniquePositions(surrounding)]).toHaveLength(count);
  });

  it('provides all HCP interstitial positions in the conventional cell', () => {
    expect(getGapPositions('HCP', 'tetra')).toHaveLength(12);
    expect(getGapPositions('HCP', 'octa')).toHaveLength(6);
  });
});

describe('coordination shells', () => {
  it.each([
    ['FCC', 12],
    ['BCC', 8],
    ['HCP', 12],
  ] as const)('%s boundary atoms retain one complete nearest-neighbor shell', (crystal, count) => {
    const atoms = createAtoms(crystal, 2, false, 'coordination');
    const target = atoms.reduce((current, atom) => (
      atom.position.x + atom.position.y + atom.position.z
        < current.position.x + current.position.y + current.position.z ? atom : current
    )).position;
    const shell = coordinationShell(atoms, crystal, target);
    expect(shell?.nearest).toHaveLength(count);
    const distances = shell!.nearest.map((neighbor) => neighbor.distance);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(1e-5);
  });
});

describe('packing-plane teaching geometry', () => {
  it('defines three corners and three face centers on FCC {111}', () => {
    const sites = fcc111PackingSites();
    expect(sites).toHaveLength(6);
    expect(sites.filter((site) => site.role === 'corner')).toHaveLength(3);
    expect(sites.filter((site) => site.role === 'face')).toHaveLength(3);
    sites.forEach(({ position }) => {
      expect(position[0] + position[1] + position[2]).toBeCloseTo(1, 8);
    });
  });

  it('runs the FCC <110> arrow through a {111} face-center atom', () => {
    const [start, end] = fcc110DirectionEndpoints();
    const midpoint = start.map((value, index) => (value + end[index]) / 2) as [number, number, number];
    expect(midpoint).toEqual([0.5, 0.5, 0]);
    expect(fcc111PackingSites()).toContainEqual({ position: midpoint, role: 'face' });
  });
});

describe('carbon status copy', () => {
  it('describes an HCP tetrahedral site without falling back to octahedral copy', () => {
    const status = carbonStatus('HCP', true, true, 0);
    expect(status.text).toContain('四面体间隙');
    expect(status.text).not.toContain('八面体间隙');
    expect(status.text).toContain('碳嵌入实验未开放');
  });

  it('describes an HCP octahedral site and its disabled experiment scope', () => {
    const status = carbonStatus('HCP', true, false, 0);
    expect(status.text).toContain('八面体间隙');
    expect(status.text).toContain('碳嵌入实验未开放');
  });
});
