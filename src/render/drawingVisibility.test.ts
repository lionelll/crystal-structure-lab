import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCrystalDrawing, createHexagonalDrawing, cubeCorners, type Point3 } from '../core/crystalDrawing';
import { createDrawingScene, disposeDrawingLayer, drawingCameraReference, fitDrawingCamera, resizeDrawingCamera, setDrawingCamera, updateDrawingScene } from './crystalDrawingScene';

vi.mock('./textSprite', () => ({ createTextSprite: () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.scale.set(1.8, 1, 1);
  return sprite;
} }));
vi.mock('./drawingIndexSprite', () => ({ createDrawingIndexSprite: () => new THREE.Sprite(new THREE.SpriteMaterial()) }));

describe('actual drawing camera visibility', () => {
  it.each((['cubic', 'hexagonal'] as const).flatMap(system => (['plane', 'direction'] as const).flatMap(mode => [false, true].flatMap(rotating => [
    { width: 374, height: 290, panel: { left: 110, top: -200, right: 364, bottom: 40 } },
    { width: 374, height: 290, panel: { left: 110, top: -200, right: 364, bottom: 66 } },
    { width: 850, height: 702, panel: { left: 570, top: 12, right: 834, bottom: 372 } },
    { width: 1260, height: 700, panel: { left: 980, top: 12, right: 1244, bottom: 372 } },
  ].map(size => ({ system, mode, rotating, ...size }))))))('fits actual $system $mode states (rotating=$rotating) outside the panel at $width x $height', ({ system, mode, rotating, width, height, panel }) => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, system);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const target = new THREE.Vector3();
    const size = new THREE.Vector2(width, height);
    const reference = drawingCameraReference(system);
    setDrawingCamera(camera, target, size, reference, system);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const renderer = { getSize: (value: THREE.Vector2) => value.copy(size) } as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const drawings = system === 'cubic'
      ? cubeCorners.map(origin => createCrystalDrawing(mode, origin.map(value => value ? -1 : 1) as Point3))
      : [-1, 1].map(w => createHexagonalDrawing(mode, [1, 0, -1, w]));
    const inside = (point: THREE.Vector3, halfWidth = 0, halfHeight = 0) => {
      const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
      expect(x - halfWidth).toBeGreaterThan(0);
      expect(x + halfWidth).toBeLessThan(width);
      expect(y - halfHeight).toBeGreaterThan(0);
      expect(y + halfHeight).toBeLessThan(height);
      expect(x + halfWidth <= panel.left || x - halfWidth >= panel.right || y + halfHeight <= panel.top || y - halfHeight >= panel.bottom).toBe(true);
    };
    try {
      for (const drawing of [...drawings, null]) {
        updateDrawingScene(context, drawing);
        fitDrawingCamera(camera, target, size, context, panel, rotating);
        expect(camera.position.distanceTo(target)).toBeGreaterThan(1.6);
        expect(camera.position.distanceTo(target)).toBeLessThan(50);
        const position = camera.position.clone(), projection = camera.projectionMatrix.clone();
        for (let degrees = 0; degrees < (rotating ? 360 : 1); degrees += 10) {
          root.rotation.z = degrees * Math.PI / 180;
          root.updateMatrixWorld(true);
          for (const layer of [context.frame, context.axes]) layer.traverse(object => {
            if (object instanceof THREE.Sprite) {
              object.onBeforeRender(renderer, scene, camera, object.geometry, object.material, context.axes);
              inside(object.getWorldPosition(new THREE.Vector3()).project(camera), 18 * camera.zoom * object.scale.x / object.scale.y, 18 * camera.zoom);
            } else if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
              const points = object.geometry.getAttribute('position');
              for (let i = 0; i < points.count; i++) inside(new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld).project(camera));
            }
          });
        }
        expect(camera.position.equals(position)).toBe(true);
        expect(camera.projectionMatrix.equals(projection)).toBe(true);
      }
      const position = camera.position.clone(), projection = camera.projectionMatrix.clone();
      const oldTarget = target.clone();
      resizeDrawingCamera(camera, target, new THREE.Vector2(374, 290), reference, system);
      resizeDrawingCamera(camera, target, size, reference, system);
      expect(camera.position.distanceTo(position)).toBeLessThan(1e-12);
      expect(target.equals(oldTarget)).toBe(true);
      expect(camera.projectionMatrix.equals(projection)).toBe(true);
    } finally { disposeDrawingLayer(root); }
  });

  it('preserves the current scale when translation alone can fit the cubic axes', () => {
    const root = new THREE.Group(), context = createDrawingScene(root);
    const size = new THREE.Vector2(850, 702), target = new THREE.Vector3();
    const camera = new THREE.PerspectiveCamera(45, size.x / size.y, 0.1, 100);
    setDrawingCamera(camera, target, size, drawingCameraReference('cubic'));
    camera.lookAt(target); camera.updateMatrixWorld();
    const position = camera.position.clone();
    fitDrawingCamera(camera, target, size, context, { left: 570, top: 12, right: 834, bottom: 240 });
    expect(camera.position.distanceTo(position)).toBeLessThan(1e-12);
    disposeDrawingLayer(root);
  });

  it.each([
    { system: 'cubic' as const, mode: 'plane' as const, width: 374, height: 290 },
    { system: 'cubic' as const, mode: 'direction' as const, width: 850, height: 702 },
    { system: 'hexagonal' as const, mode: 'direction' as const, width: 374, height: 290 },
  ])('keeps $system $mode axis sprites inside $width x $height after draw and reset', ({ system, mode, width, height }) => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, system);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const target = new THREE.Vector3();
    const renderer = { getSize: (size: THREE.Vector2) => size.set(width, height) } as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    setDrawingCamera(camera, target, new THREE.Vector2(width, height), drawingCameraReference(system), system);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const drawing = system === 'cubic'
      ? createCrystalDrawing(mode, [1, -2, 1] as Point3)
      : createHexagonalDrawing(mode, [1, 0, -1, -1]);
    try {
      for (const reset of [false, true]) {
        updateDrawingScene(context, drawing);
        if (reset) {
          setDrawingCamera(camera, target, new THREE.Vector2(width, height), drawingCameraReference(system), system);
          camera.lookAt(target);
          camera.updateMatrixWorld();
        }
        fitDrawingCamera(camera, target, new THREE.Vector2(width, height), context);
        root.updateMatrixWorld(true);
        for (const label of context.axes.children.filter((object): object is THREE.Sprite => object instanceof THREE.Sprite)) {
          label.onBeforeRender(renderer, scene, camera, label.geometry, label.material, context.axes);
          const point = label.getWorldPosition(new THREE.Vector3()).project(camera);
          expect(Math.abs(point.x) + 36 * camera.zoom * label.scale.x / label.scale.y / width).toBeLessThan(1);
          expect(Math.abs(point.y) + 36 * camera.zoom / height).toBeLessThan(1);
        }
      }
    } finally { disposeDrawingLayer(root); }
  });
});
