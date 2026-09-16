import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { cubeCorners, type Point3 } from '../core/crystalDrawing';
import { createDrawingScene, disposeDrawingLayer, drawingAxisLength, drawingCameraPreset, drawingModelMagnification, setDrawingCamera } from './crystalDrawingScene';

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

  it.each([[374, 290], [364, 550], [840, 700], [1260, 700]])('renders the default cell at 200%% of the fitted size at %ix%i', (width, height) => {
    const preset = drawingCameraPreset(width / height, reference, height);
    const target = new THREE.Vector3(...preset.target);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(...preset.position);
    camera.up.set(...preset.up);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const projectedSize = () => {
      camera.updateProjectionMatrix();
      const points = cubeCorners.map((point) => new THREE.Vector3(...point).addScalar(-0.5).multiplyScalar(2.65).project(camera));
      return new THREE.Vector2(
        (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * width / 2,
        (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * height / 2,
      );
    };
    camera.zoom = 1;
    const fitted = projectedSize();
    setDrawingCamera(camera, target, new THREE.Vector2(width, height), reference);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const enlarged = projectedSize();
    expect(drawingModelMagnification).toBe(2);
    expect(camera.zoom).toBe(2);
    expect(enlarged.x / fitted.x).toBeGreaterThanOrEqual(1.98);
    expect(enlarged.x / fitted.x).toBeLessThanOrEqual(2.02);
    expect(enlarged.y / fitted.y).toBeGreaterThanOrEqual(1.98);
    expect(enlarged.y / fitted.y).toBeLessThanOrEqual(2.02);
  });

  it('builds a simple hexagonal prism with four crystallographic axes', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, 'hexagonal');
    try {
      expect(context.frame.geometry.getAttribute('position').count).toBe(36);
      expect(context.axes.children.filter((object) => object instanceof THREE.ArrowHelper)).toHaveLength(4);
      expect(context.origin).toEqual([0, 0, -0.5]);
    } finally { disposeDrawingLayer(root); }
  });
});
