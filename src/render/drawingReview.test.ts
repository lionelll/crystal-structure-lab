import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCrystalDrawing, cubeCorners, type Point3 } from '../core/crystalDrawing';
import { createDrawingScene, disposeDrawingLayer, drawingAxisLength, drawingCameraPreset, resizeDrawingCamera, setDrawingCamera, updateDrawingScene } from './crystalDrawingScene';

vi.mock('./textSprite', () => ({ createTextSprite: () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.scale.set(1.6, 1, 1);
  return sprite;
} }));

const reference = { up: [0, 0, 1], position: [5.022, -4.536, 4.212], target: [0, 0, 0] } satisfies Record<string, Point3>;
const worldPoint = (point: Point3) => new THREE.Vector3(...point).addScalar(-0.5).multiplyScalar(2.65);
function makeCamera(aspect = 1.2, height = 700) {
  const preset = drawingCameraPreset(aspect, reference, height);
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
  camera.position.set(...preset.position);
  camera.up.set(...preset.up);
  camera.lookAt(new THREE.Vector3(...preset.target));
  camera.updateMatrixWorld();
  return camera;
}

function labelFixture(indices: Point3) {
  const root = new THREE.Group();
  const context = createDrawingScene(root);
  const drawing = createCrystalDrawing('direction', indices);
  if (drawing.mode !== 'direction') throw new Error('Expected direction');
  updateDrawingScene(context, drawing);
  const label = context.overlay.getObjectByName('drawing-index-label') as THREE.Sprite;
  const renderer = { getSize: (size: THREE.Vector2) => size.set(840, 700) } as THREE.WebGLRenderer;
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  const render = (camera: THREE.PerspectiveCamera) => {
    camera.updateMatrixWorld();
    root.updateMatrixWorld(true);
    label.onBeforeRender(renderer, scene, camera, geometry, label.material, context.overlay);
    const position = label.getWorldPosition(new THREE.Vector3()).project(camera);
    return new THREE.Vector2(position.x * 420, position.y * 350);
  };
  const dispose = () => { geometry.dispose(); disposeDrawingLayer(root); };
  return { root, label, drawing, render, dispose };
}

describe('drawing review regressions', () => {
  it('preserves orbit, pan, root rotation and relative zoom through repeated viewport round trips', () => {
    const camera = makeCamera();
    const target = new THREE.Vector3();
    const initialSize = new THREE.Vector2(840, 700);
    setDrawingCamera(camera, target, initialSize, reference);
    const pan = new THREE.Vector3(0.4, -0.3, 0.2);
    camera.position.sub(target).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.8).multiplyScalar(1.3).add(target).add(pan);
    target.add(pan);
    camera.zoom = 1.1;
    camera.lookAt(target);
    const before = { position: camera.position.clone(), target: target.clone(), quaternion: camera.quaternion.clone(), up: camera.up.clone() };
    const direction = camera.position.clone().sub(target).normalize();
    const root = new THREE.Group();
    root.rotation.set(0.2, -0.1, 2.7);
    const rotation = root.rotation.clone();
    for (const size of [[364, 550], [1400, 720], [840, 700], [364, 550], [840, 700]]) {
      resizeDrawingCamera(camera, target, new THREE.Vector2(...size), reference);
      expect(camera.aspect).toBe(size[0] / size[1]);
      expect(camera.position.clone().sub(target).normalize().distanceTo(direction)).toBeLessThan(1e-12);
      expect(camera.position.distanceTo(target) / camera.userData.drawingBaseDistance).toBeCloseTo(1.3, 12);
      expect(camera.quaternion.equals(before.quaternion)).toBe(true);
      expect(target.equals(before.target)).toBe(true);
      expect(camera.up.equals(before.up)).toBe(true);
      expect(camera.zoom).toBe(1.1);
      expect(root.rotation.equals(rotation)).toBe(true);
    }
    expect(camera.position.distanceTo(before.position)).toBeLessThan(1e-12);
    resizeDrawingCamera(camera, target, new THREE.Vector2(0, 0), reference);
    expect(camera.position.distanceTo(before.position)).toBeLessThan(1e-12);
    expect(camera.aspect).toBe(1.2);
  });

  it.each([[374, 290], [364, 550], [840, 700], [1260, 700]])('frames actual arrow geometry, cell edges and axis sprites at %j', (width, height) => {
    const camera = makeCamera(width / height, height);
    const root = new THREE.Group();
    const context = createDrawingScene(root);
    const scene = new THREE.Scene();
    const renderer = { getSize: (size: THREE.Vector2) => size.set(width, height) } as THREE.WebGLRenderer;
    let overflow = -Infinity;
    try {
      for (const origin of cubeCorners) {
        updateDrawingScene(context, createCrystalDrawing('direction', origin.map((value) => value ? -1 : 1) as Point3));
        for (let degrees = 0; degrees < 360; degrees += 5) {
          root.rotation.z = degrees * Math.PI / 180;
          root.updateMatrixWorld(true);
          for (const layer of [context.frame, context.axes]) layer.traverse((object) => {
            if (object instanceof THREE.Sprite) {
              object.onBeforeRender(renderer, scene, camera, object.geometry, object.material, context.axes);
              const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
              const halfWidth = 18 * object.scale.x / object.scale.y;
              overflow = Math.max(overflow, Math.abs(point.x) + halfWidth * 2 / width - 1, Math.abs(point.y) + 36 / height - 1);
            } else if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
              const points = object.geometry.getAttribute('position');
              for (let i = 0; i < points.count; i++) {
                const point = new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld).project(camera);
                overflow = Math.max(overflow, Math.abs(point.x) - 1, Math.abs(point.y) - 1);
              }
            }
          });
        }
      }
      expect(overflow).toBeLessThan(0);
    } finally { disposeDrawingLayer(root); }
  });

  it.each([0.75, 1.2, 1.8])('keeps all shifted axes and full labels inside a complete rotation at aspect %f', (aspect) => {
    const camera = makeCamera(aspect);
    let overflow = -Infinity;
    for (const origin of cubeCorners) for (let axis = 0; axis < 3; axis++) {
      const endpoint: Point3 = [...origin];
      endpoint[axis] += drawingAxisLength + 0.12;
      for (let degrees = 0; degrees < 360; degrees++) {
        const point = worldPoint(endpoint).applyAxisAngle(new THREE.Vector3(0, 0, 1), degrees * Math.PI / 180).project(camera);
        overflow = Math.max(overflow, Math.abs(point.x) + 36 / (aspect * 350) - 1, Math.abs(point.y) + 18 / 350 - 1);
      }
    }
    expect(overflow).toBeLessThan(0);
  });

  it.each([[1, 1, 0], [1, 0, 0], [-1, 1, 1]] as Point3[])('moves the direction label continuously for %j', (...indices) => {
    const fixture = labelFixture(indices as Point3);
    const camera = makeCamera();
    let previous = fixture.render(camera);
    let largestStep = 0;
    try {
      for (let step = 1; step <= 3600; step++) {
        fixture.root.rotation.z = step * Math.PI / 1800;
        const position = fixture.render(camera);
        largestStep = Math.max(largestStep, position.distanceTo(previous));
        previous = position;
      }
      expect(largestStep).toBeLessThan(4);
    } finally { fixture.dispose(); }
  });

  it('holds a finite, continuous label offset when the arrow passes through the view direction', () => {
    const fixture = labelFixture([1, 0, 0]);
    const camera = makeCamera();
    const anchor = worldPoint(fixture.drawing.origin).lerp(worldPoint(fixture.drawing.end), 0.6);
    let previous: THREE.Vector2 | undefined;
    let largestStep = 0;
    try {
      for (let step = -100; step <= 100; step++) {
        const angle = step / 5000;
        camera.position.copy(anchor).add(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(18));
        camera.lookAt(anchor);
        const position = fixture.render(camera);
        expect(Number.isFinite(position.x) && Number.isFinite(position.y)).toBe(true);
        if (previous) largestStep = Math.max(largestStep, previous.distanceTo(position));
        previous = position;
      }
      expect(largestStep).toBeLessThan(4);
    } finally { fixture.dispose(); }
  });

  it('does not chase unstable projected directions near an end-on arrow', () => {
    const fixture = labelFixture([1, 0, 0]);
    const camera = makeCamera();
    const anchor = worldPoint(fixture.drawing.origin).lerp(worldPoint(fixture.drawing.end), 0.6);
    let previous: THREE.Vector2 | undefined;
    let largestStep = 0;
    try {
      for (let step = 0; step <= 360; step++) {
        const angle = step * Math.PI / 180;
        camera.position.copy(anchor).add(new THREE.Vector3(18, 0.1 * Math.sin(angle), 0.1 * Math.cos(angle)));
        camera.lookAt(anchor);
        const position = fixture.render(camera);
        if (previous) largestStep = Math.max(largestStep, previous.distanceTo(position));
        previous = position;
      }
      expect(largestStep).toBeLessThan(1);
    } finally { fixture.dispose(); }
  });

  it('recovers smoothly after leaving an end-on view on a different side', () => {
    const fixture = labelFixture([1, 0, 0]);
    const camera = makeCamera();
    const anchor = worldPoint(fixture.drawing.origin).lerp(worldPoint(fixture.drawing.end), 0.6);
    let previous: THREE.Vector2 | undefined;
    let largestStep = 0;
    try {
      for (let step = 0; step <= 300; step++) {
        const radius = step < 100 ? 2 - step * 0.019 : step < 200 ? 0.1 : 0.1 + (step - 200) * 0.019;
        const angle = step < 100 ? 0 : step < 200 ? (step - 100) * Math.PI / 200 : Math.PI / 2;
        camera.position.copy(anchor).add(new THREE.Vector3(18, radius * Math.sin(angle), radius * Math.cos(angle)));
        camera.lookAt(anchor);
        const position = fixture.render(camera);
        if (previous) largestStep = Math.max(largestStep, previous.distanceTo(position));
        previous = position;
      }
      expect(largestStep).toBeLessThan(4);
    } finally { fixture.dispose(); }
  });
});
