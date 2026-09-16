import * as THREE from 'three';
import { cubeCorners, cubeEdges, hexPrismCorners, hexPrismEdges, type CrystalDrawing, type DrawingCrystalSystem, type Point3 } from '../core/crystalDrawing';
import { latticeGeometry } from '../data/latticeGeometry';
import { addPackingDirectionVector, createPackingPlaneMaterial } from './packingPrimitives';
import { createTextSprite } from './textSprite';
import { createDrawingIndexSprite } from './drawingIndexSprite';

const scale = latticeGeometry.FCC.worldA;
export const drawingAxisLength = 1.5;
export const hexagonalDrawingAxisRatio = 1.633;
export const drawingModelMagnification = 1.4;
const labelHeight = 36;
const axisLabelOffset = 0.12;
const worldPoint = (point: Point3, crystalSystem: DrawingCrystalSystem) => (
  crystalSystem === 'cubic'
    ? new THREE.Vector3(...point).addScalar(-0.5).multiplyScalar(scale)
    : new THREE.Vector3(...point).multiplyScalar(scale)
);

function drawingAxisExtent(crystalSystem: DrawingCrystalSystem, axis: number) {
  return crystalSystem === 'hexagonal' && axis < 3
    ? drawingAxisLength / hexagonalDrawingAxisRatio
    : drawingAxisLength;
}

function scaleDrawingLabel(label: THREE.Sprite, fixedScreenSize = false) {
  const ratio = label.scale.x / label.scale.y;
  const position = new THREE.Vector3();
  const viewport = new THREE.Vector2();
  label.onBeforeRender = (renderer, _scene, camera) => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    label.getWorldPosition(position).applyMatrix4(camera.matrixWorldInverse);
    renderer.getSize(viewport);
    const fov = fixedScreenSize ? camera.getEffectiveFOV() : camera.fov;
    const height = 2 * Math.abs(position.z) * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * labelHeight / viewport.y;
    label.scale.set(height * ratio, height, 1);
    label.updateMatrixWorld();
  };
  return label;
}

function drawingLabel(text: string, color: string, size = 36) {
  return scaleDrawingLabel(createTextSprite(text, color, size));
}

function offsetDirectionLabel(label: THREE.Sprite, start: THREE.Vector3, end: THREE.Vector3) {
  const resize = label.onBeforeRender;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), anchor = start.clone().lerp(end, 0.6);
  const right = new THREE.Vector3(), up = new THREE.Vector3(), viewport = new THREE.Vector2();
  const previousNormal = new THREE.Vector2(0, 1);
  let hasNormal = false;
  let nearViewAxis = false;
  let recovering = false;
  label.position.copy(anchor);
  label.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !label.parent) return;
    from.copy(start).applyMatrix4(label.parent.matrixWorld).project(camera);
    to.copy(end).applyMatrix4(label.parent.matrixWorld).project(camera);
    renderer.getSize(viewport);
    const normal = new THREE.Vector2(-(to.y - from.y) * viewport.y / 2, (to.x - from.x) * viewport.x / 2);
    // Retain the last side across vertical projections and nearly end-on views.
    if (normal.length() < (nearViewAxis ? 6 : 3)) {
      nearViewAxis = true;
      hasNormal = true;
    } else {
      recovering ||= nearViewAxis;
      nearViewAxis = false;
      normal.normalize();
      if (hasNormal ? normal.dot(previousNormal) < 0 : normal.y < 0) normal.negate();
      if (recovering) {
        const angle = Math.atan2(previousNormal.cross(normal), previousNormal.dot(normal));
        const step = THREE.MathUtils.clamp(angle, -0.04, 0.04);
        const x = previousNormal.x * Math.cos(step) - previousNormal.y * Math.sin(step);
        const y = previousNormal.x * Math.sin(step) + previousNormal.y * Math.cos(step);
        previousNormal.set(x, y);
        recovering = Math.abs(angle) > 0.04;
      } else {
        previousNormal.copy(normal);
      }
      hasNormal = true;
    }
    normal.copy(previousNormal);
    const position = anchor.clone().applyMatrix4(label.parent.matrixWorld);
    const depth = Math.abs(position.clone().applyMatrix4(camera.matrixWorldInverse).z);
    const perPixel = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2)) / viewport.y;
    const ratio = label.scale.x / label.scale.y;
    const gap = 8 + 18 * (Math.abs(normal.x) * ratio + Math.abs(normal.y));
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    position.addScaledVector(right, normal.x * gap * perPixel).addScaledVector(up, normal.y * gap * perPixel);
    label.position.copy(label.parent.worldToLocal(position));
    label.updateMatrixWorld();
    resize.call(label, renderer, scene, camera, geometry, material, group);
  };
}

export interface DrawingScene {
  crystalSystem: DrawingCrystalSystem;
  frame: THREE.LineSegments;
  axes: THREE.Group;
  overlay: THREE.Group;
  marker: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  origin: Point3;
  pulseStart: number | null;
}

export function disposeDrawingLayer(group: THREE.Group) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      (material as THREE.MeshBasicMaterial | undefined)?.map?.dispose();
      material?.dispose();
    }
  });
  group.clear();
}

function updateAxes(context: DrawingScene, origin: Point3) {
  disposeDrawingLayer(context.axes);
  const start = worldPoint(origin, context.crystalSystem);
  const axes = context.crystalSystem === 'cubic'
    ? [
        { label: 'X', direction: new THREE.Vector3(1, 0, 0), color: '#ff554f' },
        { label: 'Y', direction: new THREE.Vector3(0, 1, 0), color: '#3bd56f' },
        { label: 'Z', direction: new THREE.Vector3(0, 0, 1), color: '#4385ff' },
      ]
    : [
        { label: 'a₁', direction: new THREE.Vector3(1, 0, 0), color: '#ff554f' },
        { label: 'a₂', direction: new THREE.Vector3(-0.5, Math.sqrt(3) / 2, 0), color: '#3bd56f' },
        { label: 'a₃', direction: new THREE.Vector3(-0.5, -Math.sqrt(3) / 2, 0), color: '#ffa43a' },
        { label: 'c', direction: new THREE.Vector3(0, 0, 1), color: '#4385ff' },
      ];
  axes.forEach(({ label, direction, color }, axis) => {
    const length = drawingAxisExtent(context.crystalSystem, axis);
    const arrow = new THREE.ArrowHelper(direction, start, scale * length, color, 0.21, 0.11);
    arrow.line.geometry = arrow.line.geometry.clone();
    arrow.cone.geometry = arrow.cone.geometry.clone();
    context.axes.add(arrow);
    const axisLabel = drawingLabel(label, color);
    axisLabel.position.copy(start).addScaledVector(direction, scale * (length + axisLabelOffset));
    context.axes.add(axisLabel);
    if (context.crystalSystem === 'cubic' && origin[axis] === 1) {
      const end = start.clone().addScaledVector(direction, -scale);
      const negativeAxis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), new THREE.LineDashedMaterial({ color, dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.7, fog: false }));
      negativeAxis.computeLineDistances();
      context.axes.add(negativeAxis);
    }
  });
  const label = drawingLabel('O', '#fde047', 30);
  label.position.copy(start).add(new THREE.Vector3(-0.13, -0.13, -0.18));
  context.axes.add(label);
  context.marker.position.copy(start);
  context.origin = [...origin];
}

export function createDrawingScene(root: THREE.Group, crystalSystem: DrawingCrystalSystem = 'cubic'): DrawingScene {
  const corners = crystalSystem === 'cubic' ? cubeCorners : hexPrismCorners;
  const edges = crystalSystem === 'cubic' ? cubeEdges : hexPrismEdges;
  const frame = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(edges.flatMap(([a, b]) => [worldPoint(corners[a], crystalSystem), worldPoint(corners[b], crystalSystem)])),
    new THREE.LineBasicMaterial({ color: '#eef5ff', transparent: true, opacity: 0.72, fog: false }),
  );
  frame.name = 'drawing-cell-frame';
  const axes = new THREE.Group();
  const overlay = new THREE.Group();
  overlay.name = 'drawing-overlay';
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 16), new THREE.MeshBasicMaterial({ color: '#fde047', fog: false, depthTest: false }));
  marker.renderOrder = 30;
  root.add(frame, axes, overlay, marker);
  const defaultOrigin: Point3 = crystalSystem === 'cubic' ? [0, 0, 0] : [0, 0, -0.5];
  const context: DrawingScene = { crystalSystem, frame, axes, overlay, marker, origin: defaultOrigin, pulseStart: null };
  updateAxes(context, defaultOrigin);
  return context;
}

export function updateDrawingScene(context: DrawingScene, drawing: CrystalDrawing | null, now = performance.now()) {
  disposeDrawingLayer(context.overlay);
  const origin: Point3 = drawing?.origin ?? (context.crystalSystem === 'cubic' ? [0, 0, 0] : [0, 0, -0.5]);
  const moved = origin.some((value, i) => value !== context.origin[i]);
  if (moved) updateAxes(context, origin);
  context.pulseStart = moved && drawing !== null ? now : null;
  context.marker.scale.setScalar(1);
  if (!drawing) return;

  let labelPosition: THREE.Vector3;
  if (drawing.mode === 'plane') {
    const vertices = drawing.vertices.map((point) => worldPoint(point, context.crystalSystem));
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    const indices: number[] = [];
    for (let i = 1; i < vertices.length - 1; i++) indices.push(0, i, i + 1);
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = createPackingPlaneMaterial();
    const plane = new THREE.Mesh(geometry, material);
    plane.name = 'drawn-plane';
    context.overlay.add(plane);
    labelPosition = vertices.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(vertices.length);
  } else {
    const start = worldPoint(origin, context.crystalSystem);
    const end = worldPoint(drawing.end, context.crystalSystem);
    addPackingDirectionVector(context.overlay, start, end);
    labelPosition = start.clone().lerp(end, 0.65);
  }
  const label = scaleDrawingLabel(createDrawingIndexSprite(drawing.mode, drawing.indices), true);
  label.name = 'drawing-index-label';
  label.position.copy(labelPosition).add(new THREE.Vector3(0, 0, 0.32));
  if (drawing.mode === 'direction') offsetDirectionLabel(label, worldPoint(origin, context.crystalSystem), worldPoint(drawing.end, context.crystalSystem));
  label.renderOrder = 40;
  context.overlay.add(label);
}

export function tickDrawingScene(context: DrawingScene, now: number) {
  if (context.pulseStart === null) return;
  const progress = Math.min(1, (now - context.pulseStart) / 450);
  context.marker.scale.setScalar(1 + 0.7 * Math.sin(progress * Math.PI * 3) * (1 - progress));
  if (progress >= 1) context.pulseStart = null;
}

type DrawingCameraReference = { up: Point3; position: Point3; target: Point3 };

export function drawingCameraReference(crystalSystem: DrawingCrystalSystem): DrawingCameraReference {
  const azimuth = THREE.MathUtils.degToRad(crystalSystem === 'cubic' ? 18 : 39);
  const elevation = THREE.MathUtils.degToRad(18);
  return {
    up: [0, 0, 1],
    position: [Math.cos(azimuth) * Math.cos(elevation), Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation)],
    target: [0, 0, 0],
  };
}

export function drawingCameraPreset(aspect: number, reference: DrawingCameraReference, viewportHeight = 700, crystalSystem: DrawingCrystalSystem = 'cubic') {
  const target = new THREE.Vector3(...reference.target);
  const direction = new THREE.Vector3(...reference.position).sub(target).normalize();
  const right = new THREE.Vector3(...reference.up).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(22.5));
  const viewportWidth = aspect * viewportHeight;
  const tanV = tangent * Math.max(0.1, 1 - labelHeight / viewportHeight);
  const tanH = tangent * aspect * Math.max(0.1, 1 - labelHeight * 2 / viewportWidth);
  const bounds = crystalSystem === 'cubic'
    ? cubeCorners.flatMap((origin) => [
        worldPoint(origin, crystalSystem),
        worldPoint(origin, crystalSystem).add(new THREE.Vector3(-0.13, -0.13, -0.18)),
        ...[0, 1, 2].map((axis) => {
          const end: Point3 = [...origin];
          end[axis] += drawingAxisLength + axisLabelOffset;
          return worldPoint(end, crystalSystem);
        }),
      ])
    : [
        ...hexPrismCorners.map((point) => worldPoint(point, crystalSystem)),
        ...[
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-0.5, Math.sqrt(3) / 2, 0),
          new THREE.Vector3(-0.5, -Math.sqrt(3) / 2, 0),
          new THREE.Vector3(0, 0, 1),
          // Preserve the previous framing footprint when shortening basal axes.
        ].map((direction) => worldPoint([0, 0, -0.5], crystalSystem).addScaledVector(direction, scale * (drawingAxisLength + axisLabelOffset))),
      ];
  // A point's full Z orbit has this exact support, without angle sampling gaps.
  const support = (normal: THREE.Vector3) => Math.max(...bounds.map((point) =>
    Math.hypot(point.x, point.y) * Math.hypot(normal.x, normal.y) + point.z * normal.z,
  ));
  const constraint = (axis: THREE.Vector3, slope: number, sign: number) => direction.clone().addScaledVector(axis, sign / slope);
  const upper = constraint(up, tangent, 1), lower = constraint(up, tangent, -1);
  const center = tangent * (support(upper) - target.dot(upper) - support(lower) + target.dot(lower)) / 2;
  // Keep the same target at every viewport size so resize can preserve user pan.
  target.addScaledVector(up, center);
  let distance = Math.max(...[
    constraint(right, tanH, -1), constraint(right, tanH, 1),
    constraint(up, tanV, -1), constraint(up, tanV, 1),
  ].map((normal) => support(normal) - target.dot(normal))) + 0.05;
  if (crystalSystem === 'hexagonal') {
    // The default view targets the cell center; include the zoomed c-axis label.
    const extent = worldPoint([0, 0, -0.5], crystalSystem)
      .add(new THREE.Vector3(0, 0, scale * (drawingAxisLength + axisLabelOffset)));
    const slope = tangent * (1 - labelHeight * drawingModelMagnification / viewportHeight) / drawingModelMagnification;
    distance = Math.max(distance, extent.dot(constraint(up, Math.max(slope, 0.01), 1)) + 0.05);
  }
  return { up: [...reference.up] as Point3, target: target.toArray() as Point3, position: target.clone().addScaledVector(direction, distance).toArray() as Point3 };
}

export function setDrawingCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, viewport: THREE.Vector2, reference: DrawingCameraReference, crystalSystem: DrawingCrystalSystem = 'cubic') {
  const preset = drawingCameraPreset(viewport.x / viewport.y, reference, viewport.y, crystalSystem);
  const fittedTarget = new THREE.Vector3(...preset.target);
  const direction = new THREE.Vector3(...preset.position).sub(fittedTarget).normalize();
  const distance = new THREE.Vector3(...preset.position).distanceTo(fittedTarget);
  camera.aspect = viewport.x / viewport.y;
  camera.up.set(...preset.up);
  target.set(0, 0, 0);
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.zoom = drawingModelMagnification;
  camera.userData.drawingBaseDistance = camera.position.distanceTo(target);
  camera.updateProjectionMatrix();
}

export function resizeDrawingCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, viewport: THREE.Vector2, reference: DrawingCameraReference, crystalSystem: DrawingCrystalSystem = 'cubic') {
  if (viewport.x <= 0 || viewport.y <= 0) return 1;
  const preset = drawingCameraPreset(viewport.x / viewport.y, reference, viewport.y, crystalSystem);
  const distance = new THREE.Vector3(...preset.position).distanceTo(new THREE.Vector3(...preset.target));
  const previousDistance = camera.userData.drawingBaseDistance as number | undefined;
  const ratio = previousDistance ? distance / previousDistance : 1;
  camera.position.sub(target).multiplyScalar(ratio).add(target);
  camera.userData.drawingBaseDistance = distance;
  camera.aspect = viewport.x / viewport.y;
  camera.updateProjectionMatrix();
  return ratio;
}
