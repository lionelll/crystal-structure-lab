import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { cubeCorners, type Point3 } from '../core/crystalDrawing';
import { createDrawingScene, disposeDrawingLayer, drawingAxisLength, drawingCameraPreset } from './crystalDrawingScene';

vi.mock('./textSprite', () => ({ createTextSprite: () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.scale.set(1.6, 1, 1);
  return sprite;
} }));

const reference = { up: [0, 0, 1], position: [5.022, -4.536, 4.212], target: [0, 0, 0] } satisfies Record<string, Point3>;

describe('drawing size adjustment', () => {
  it('uses 1.5a axes without changing the unit cell dimensions', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    try {
      expect(drawingAxisLength).toBe(1.5);
      const arrows = context.axes.children.filter((object): object is THREE.ArrowHelper => object instanceof THREE.ArrowHelper);
      expect(arrows).toHaveLength(3);
      for (const arrow of arrows) expect(arrow.cone.position.y).toBeCloseTo(2.65 * 1.5, 12);
      context.frame.geometry.computeBoundingBox();
      expect(context.frame.geometry.boundingBox!.getSize(new THREE.Vector3()).toArray()).toEqual([
        expect.closeTo(2.65, 6), expect.closeTo(2.65, 6), expect.closeTo(2.65, 6),
      ]);
    } finally { disposeDrawingLayer(root); }
  });

  // Original 1.8a bounds plus approved targets after the follow-up padding reduction.
  it.each([
    [374, 290, 69.0590842409101, 75.84786894673535, 81.7327621308477, 89.16630277184649],
    [364, 550, 78.51769418610661, 87.16035339432896, 92.88975430300287, 102.67644488845637],
    [840, 700, 184.70615677602052, 202.30541221939228, 212.86242884650807, 231.6496720815918],
    [1260, 700, 184.7061567760205, 202.30541221939228, 212.8624288465081, 231.6496720815918],
  ])('matches the enlarged framing target at %ix%i with the same orientation', (width, height, oldWidth, oldHeight, expectedWidth, expectedHeight) => {
    const preset = drawingCameraPreset(width / height, reference, height);
    const target = new THREE.Vector3(...preset.target);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(...preset.position);
    camera.up.set(...preset.up);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const direction = camera.position.clone().sub(target).normalize();
    const referenceDirection = new THREE.Vector3(...reference.position).sub(new THREE.Vector3(...reference.target)).normalize();
    expect(direction.distanceTo(referenceDirection)).toBeLessThan(1e-12);
    expect(preset.up).toEqual(reference.up);
    const points = cubeCorners.map((point) => new THREE.Vector3(...point).addScalar(-0.5).multiplyScalar(2.65).project(camera));
    const projectedWidth = (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * width / 2;
    const projectedHeight = (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * height / 2;
    expect(projectedWidth / oldWidth).toBeGreaterThanOrEqual(1.12);
    expect(projectedHeight / oldHeight).toBeGreaterThanOrEqual(1.12);
    expect(projectedWidth).toBeCloseTo(expectedWidth, 8);
    expect(projectedHeight).toBeCloseTo(expectedHeight, 8);
  });
});
