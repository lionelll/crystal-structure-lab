import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCrystalDrawing, createHexagonalDrawing, cubeCorners, type Point3 } from '../core/crystalDrawing';
import { latticeGeometry } from '../data/latticeGeometry';
import { cameraPreset, createAtoms, sceneStructureKey } from '../components/CrystalCanvas';
import { createDrawingScene, disposeDrawingLayer, drawingAxisLength, drawingCameraPreset, drawingCameraReference, setDrawingCamera, tickDrawingScene, updateDrawingScene } from './crystalDrawingScene';
import { createPackingPlaneMaterial, packingDirectionStyle } from './packingPrimitives';

vi.mock('./textSprite', () => ({ createTextSprite: (text: string) => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.userData.text = text;
  return sprite;
} }));
vi.mock('./drawingIndexSprite', () => ({ createDrawingIndexSprite: () => (
  new THREE.Sprite(new THREE.SpriteMaterial())
) }));

describe('drawing overlay lifecycle', () => {
  it('replaces only the drawing layer without moving the root or recreating the frame', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    const frame = context.frame;
    root.rotation.set(0.2, -0.1, 0.9);
    const rotation = root.rotation.clone();
    for (let i = 0; i < 40; i++) {
      updateDrawingScene(context, createCrystalDrawing(i % 2 ? 'plane' : 'direction', [i % 3 ? -1 : 2, 1, 0]));
      expect(context.frame).toBe(frame);
      expect(root.rotation.equals(rotation)).toBe(true);
      expect(root.children).toHaveLength(4);
      expect(context.overlay.children.length).toBeLessThanOrEqual(3);
    }
    updateDrawingScene(context, null);
    expect(context.origin).toEqual([0, 0, 0]);
    expect(context.overlay.children).toHaveLength(0);
    expect(root.rotation.equals(rotation)).toBe(true);
    disposeDrawingLayer(root);
  });

  it('disposes replaced geometry and materials', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    updateDrawingScene(context, createCrystalDrawing('plane', [1, 1, 1]));
    const plane = context.overlay.getObjectByName('drawn-plane') as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const disposeGeometry = vi.spyOn(plane.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(plane.material, 'dispose');
    updateDrawingScene(context, null);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    disposeDrawingLayer(root);
  });

  it('only pulses the origin after translation and ends the pulse deterministically', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    updateDrawingScene(context, createCrystalDrawing('plane', [-1, 1, 0]), 100);
    expect(context.marker.position.toArray()).toEqual([1.325, -1.325, -1.325]);
    tickDrawingScene(context, 160);
    expect(context.marker.scale.x).not.toBe(1);
    tickDrawingScene(context, 550);
    expect(context.pulseStart).toBeNull();
    expect(context.marker.scale.x).toBe(1);
    updateDrawingScene(context, null);
    expect(context.marker.position.toArray()).toEqual([-1.325, -1.325, -1.325]);
    disposeDrawingLayer(root);
  });

  it('uses the exact packing plane material and arrow proportions', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    updateDrawingScene(context, createCrystalDrawing('plane', [1, 0, 0]));
    const plane = context.overlay.getObjectByName('drawn-plane') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const expected = createPackingPlaneMaterial();
    expect(plane.material.color.getHexString()).toBe(expected.color.getHexString());
    expect(plane.material.opacity).toBe(0.6);
    expect(plane.material.side).toBe(THREE.DoubleSide);
    expect(plane.material.depthWrite).toBe(false);
    updateDrawingScene(context, createCrystalDrawing('direction', [1, 1, 1]));
    const shaft = context.overlay.children[0] as THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
    expect(shaft.geometry.parameters.radius).toBe(packingDirectionStyle.shaftRadius);
    expect(shaft.material.color.getHexString()).toBe('ef4444');
    expected.dispose();
    disposeDrawingLayer(root);
  });

  it('renders hexagonal planes and directions in the same replaceable overlay', () => {
    const root = new THREE.Group();
    const context = createDrawingScene(root, 'hexagonal');
    updateDrawingScene(context, createHexagonalDrawing('plane', [1, 0, -1, 0]));
    expect(context.overlay.getObjectByName('drawn-plane')).toBeTruthy();
    expect(context.overlay.getObjectByName('drawing-index-label')).toBeTruthy();
    updateDrawingScene(context, createHexagonalDrawing('direction', [2, -1, -1, 0]));
    expect(context.overlay.getObjectByName('drawn-plane')).toBeFalsy();
    expect(context.overlay.getObjectByName('drawing-index-label')).toBeTruthy();
    disposeDrawingLayer(root);
  });

  it('never builds atoms or keys scene reconstruction on rotation/supercell settings', () => {
    for (const crystal of ['FCC', 'BCC'] as const) {
      expect(createAtoms(crystal, 2, 'drawing')).toEqual([]);
      expect(sceneStructureKey(crystal, 'drawing', { autoRotate: false, showSupercell: false }))
        .toBe(sceneStructureKey(crystal, 'drawing', { autoRotate: true, showSupercell: true }));
    }
  });

  it.each([0.75, 1, 1.8])('frames axes at every shifted origin with aspect %f', (aspect) => {
    const preset = drawingCameraPreset(aspect, cameraPreset('FCC', 1, 'cell'));
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(...preset.position);
    camera.up.set(...preset.up);
    camera.lookAt(new THREE.Vector3(...preset.target));
    camera.updateMatrixWorld();
    for (const origin of cubeCorners) for (let i = 0; i < 3; i++) {
      const endpoint: Point3 = [...origin];
      endpoint[i] += drawingAxisLength + 0.12;
      const projected = new THREE.Vector3(...endpoint).addScalar(-0.5).multiplyScalar(latticeGeometry.FCC.worldA).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
    }
  });

  it.each(['cubic', 'hexagonal'] as const)('preserves the dedicated %s drawing camera orientation while fitting', (system) => {
    const reference = drawingCameraReference(system);
    const preset = drawingCameraPreset(1.2, reference, 700, system);
    const direction = (value: typeof preset) => new THREE.Vector3(...value.position).sub(new THREE.Vector3(...value.target)).normalize();
    expect(direction(preset).distanceTo(direction(reference))).toBeLessThan(1e-12);
    expect(preset.up).toEqual(reference.up);
    expect(new THREE.Vector3(...preset.position).distanceTo(new THREE.Vector3(...preset.target))).toBeLessThan(18);
  });

  it.each(['cubic', 'hexagonal'] as const)('projects the %s axes in the reference image directions', (system) => {
    const camera = new THREE.PerspectiveCamera(45, 1.2, 0.1, 100);
    const target = new THREE.Vector3();
    setDrawingCamera(camera, target, new THREE.Vector2(840, 700), drawingCameraReference(system), system);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const root = new THREE.Group();
    const context = createDrawingScene(root, system);
    root.updateMatrixWorld(true);
    try {
      const axes = context.axes.children.filter((object): object is THREE.ArrowHelper => object instanceof THREE.ArrowHelper);
      const projected = axes.map((axis) => {
        const start = axis.getWorldPosition(new THREE.Vector3()).project(camera);
        const end = axis.localToWorld(new THREE.Vector3(0, axis.cone.position.y, 0)).project(camera);
        return new THREE.Vector2((end.x - start.x) * 420, (end.y - start.y) * 350);
      });
      expect(projected[0].x).toBeLessThan(0);
      expect(projected[0].y).toBeLessThan(0);
      expect(projected[1].x).toBeGreaterThan(0);
      expect(projected[1].y).toBeLessThan(0);
      expect(Math.abs(projected[1].y / projected[1].x)).toBeLessThan(0.2);
      const vertical = projected[projected.length - 1];
      expect(vertical.y).toBeGreaterThan(0);
      expect(Math.abs(vertical.x / vertical.y)).toBeLessThan(0.08);
      if (system === 'hexagonal') {
        expect(projected[2].x).toBeLessThan(0);
        expect(projected[2].y).toBeGreaterThan(0);
      }
    } finally { disposeDrawingLayer(root); }
  });

  it.each([[1, 1, 0], [1, 0, 0], [-1, 1, 1]] as Point3[])('keeps direction label clear of the projected arrow %j', (...indices) => {
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    const drawing = createCrystalDrawing('direction', indices as Point3);
    if (drawing.mode !== 'direction') throw new Error('Expected direction');
    updateDrawingScene(context, drawing);
    const label = context.overlay.getObjectByName('drawing-index-label') as THREE.Sprite;
    const preset = drawingCameraPreset(1.2, cameraPreset('FCC', 1, 'cell'));
    const camera = new THREE.PerspectiveCamera(45, 1.2, 0.1, 100);
    camera.up.set(...preset.up);
    camera.position.set(...preset.position);
    camera.lookAt(new THREE.Vector3(...preset.target));
    camera.updateMatrixWorld();
    const renderer = { getSize: (size: THREE.Vector2) => size.set(840, 700) } as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const geometry = new THREE.BufferGeometry();
    for (const angle of [0, 0.7, 1.8]) {
      root.rotation.set(0.2, -0.1, angle);
      root.updateMatrixWorld(true);
      label.onBeforeRender(renderer, scene, camera, geometry, label.material, context.overlay);
      const screen = (point: THREE.Vector3) => {
        const projected = point.project(camera);
        return new THREE.Vector2(projected.x * 420, projected.y * 350);
      };
      const world = (point: Point3) => new THREE.Vector3(...point).addScalar(-0.5).multiplyScalar(latticeGeometry.FCC.worldA).applyMatrix4(root.matrixWorld);
      const start = screen(world(drawing.origin));
      const end = screen(world(drawing.end)).sub(start);
      const offset = screen(label.getWorldPosition(new THREE.Vector3())).sub(start);
      expect(Math.abs(offset.cross(end)) / end.length()).toBeGreaterThan(20);
    }
    geometry.dispose();
    disposeDrawingLayer(root);
  });
});
