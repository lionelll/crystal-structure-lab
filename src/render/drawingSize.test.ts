import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCrystalDrawing, createHexagonalDrawing, cubeCorners, hexPrismCorners, type Point3 } from '../core/crystalDrawing';
import { createDrawingScene, disposeDrawingLayer, drawingAxisLength, drawingCameraReference, drawingModelMagnification, hexagonalDrawingAxisRatio, setDrawingCamera, updateDrawingScene } from './crystalDrawingScene';

vi.mock('./textSprite', () => ({ createTextSprite: () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.scale.set(1.6, 1, 1);
  return sprite;
} }));
vi.mock('./drawingIndexSprite', () => ({ createDrawingIndexSprite: () => {
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

  it.each((['cubic', 'hexagonal'] as const).flatMap((system) =>
    [[374, 290], [364, 550], [840, 700], [1260, 700]].map(([width, height]) => ({ system, width, height })),
  ))('renders $system at 70% of the previous default size at $width x $height', ({ system, width, height }) => {
    const target = new THREE.Vector3();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    setDrawingCamera(camera, target, new THREE.Vector2(width, height), reference, system);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const projectedSize = () => {
      camera.updateProjectionMatrix();
      const corners = system === 'cubic' ? cubeCorners : hexPrismCorners;
      const points = corners.map((point) => new THREE.Vector3(...point).addScalar(system === 'cubic' ? -0.5 : 0).multiplyScalar(2.65).project(camera));
      return new THREE.Vector2(
        (Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x))) * width / 2,
        (Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y))) * height / 2,
      );
    };
    const reduced = projectedSize();
    expect(drawingModelMagnification).toBe(1.4);
    expect(camera.zoom).toBe(1.4);
    camera.zoom = 2;
    const previous = projectedSize();
    expect(reduced.x / previous.x).toBeCloseTo(0.7, 12);
    expect(reduced.y / previous.y).toBeCloseTo(0.7, 12);
  });

  it.each((['cubic', 'hexagonal'] as const).flatMap((system) =>
    (['plane', 'direction'] as const).map((mode) => ({ system, mode })),
  ))('keeps the $system $mode index at its original screen size through zoom and dolly', ({ system, mode }) => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, system);
    const drawing = system === 'cubic'
      ? createCrystalDrawing(mode, [1, -2, 1])
      : createHexagonalDrawing(mode, [1, 1, -2, 1]);
    updateDrawingScene(context, drawing);
    const label = context.overlay.getObjectByName('drawing-index-label') as THREE.Sprite;
    const scene = new THREE.Scene();
    const renderer = { getSize: (size: THREE.Vector2) => size.set(840, 700) } as THREE.WebGLRenderer;
    const camera = new THREE.PerspectiveCamera(45, 1.2, 0.1, 100);
    const target = new THREE.Vector3();
    setDrawingCamera(camera, target, new THREE.Vector2(840, 700), reference, system);
    try {
      for (const zoom of [1, 1.4, 2]) for (const distanceFactor of [0.8, 1.25]) {
        camera.zoom = zoom;
        camera.position.multiplyScalar(distanceFactor);
        camera.lookAt(target);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        root.updateMatrixWorld(true);
        label.onBeforeRender(renderer, scene, camera, label.geometry, label.material, context.overlay);
        const center = label.getWorldPosition(new THREE.Vector3());
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        const top = center.clone().addScaledVector(up, label.scale.y / 2).project(camera);
        const bottom = center.clone().addScaledVector(up, -label.scale.y / 2).project(camera);
        expect((top.y - bottom.y) * 350).toBeCloseTo(36, 10);
        expect(label.scale.x / label.scale.y).toBeCloseTo(1.6, 12);
      }
    } finally { disposeDrawingLayer(root); }
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

  it('keeps c unchanged and makes it exactly 1.633 times each basal axis', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, 'hexagonal');
    try {
      const arrows = context.axes.children.filter((object): object is THREE.ArrowHelper => object instanceof THREE.ArrowHelper);
      const labels = context.axes.children.filter((object): object is THREE.Sprite => object instanceof THREE.Sprite);
      const cLength = arrows[3].cone.position.y;
      expect(cLength).toBeCloseTo(2.65 * 1.5, 12);
      expect(hexagonalDrawingAxisRatio).toBe(1.633);
      for (let axis = 0; axis < 3; axis++) {
        expect(cLength / arrows[axis].cone.position.y).toBeCloseTo(1.633, 12);
        expect(arrows[axis].cone.position.y).toBeLessThan(cLength);
        expect(labels[axis].position.distanceTo(arrows[axis].position)).toBeCloseTo(arrows[axis].cone.position.y + 2.65 * 0.12, 12);
      }
    } finally { disposeDrawingLayer(root); }
  });

  it.each([[374, 290], [364, 550], [840, 700], [1260, 700]])('keeps all hexagonal axis labels in the actual default frame at %i x %i', (width, height) => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, 'hexagonal');
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const target = new THREE.Vector3();
    setDrawingCamera(camera, target, new THREE.Vector2(width, height), drawingCameraReference('hexagonal'), 'hexagonal');
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const renderer = { getSize: (size: THREE.Vector2) => size.set(width, height) } as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const labels = context.axes.children.filter((object): object is THREE.Sprite => object instanceof THREE.Sprite);
    try {
      for (let step = 0; step < 72; step++) {
        root.rotation.z = step * Math.PI / 36;
        root.updateMatrixWorld(true);
        for (const label of labels) {
          label.onBeforeRender(renderer, scene, camera, label.geometry, label.material, context.axes);
          const center = label.getWorldPosition(new THREE.Vector3()).project(camera);
          expect(Math.abs(center.x) + 36 * 1.6 * camera.zoom / width).toBeLessThan(1);
          expect(Math.abs(center.y) + 36 * camera.zoom / height).toBeLessThan(1);
        }
      }
    } finally { disposeDrawingLayer(root); }
  });
});
