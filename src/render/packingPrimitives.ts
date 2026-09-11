import * as THREE from 'three';

export const packingDirectionStyle = { shaftRadius: 0.018, headLength: 0.34, headWidth: 0.19 } as const;
export const packingPlaneColor = '#3B82F6';
export const packingDirectionColor = '#EF4444';

export function createPackingPlaneMaterial() {
  return new THREE.MeshBasicMaterial({ color: packingPlaneColor, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
}

export function addPackingDirectionVector(group: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, color: THREE.ColorRepresentation = packingDirectionColor) {
  const direction = end.clone().sub(start);
  const shaft = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 12, packingDirectionStyle.shaftRadius, 10, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false, fog: false }),
  );
  shaft.renderOrder = 20;
  group.add(shaft);
  const arrow = new THREE.ArrowHelper(direction.clone().normalize(), start, direction.length(), color, packingDirectionStyle.headLength, packingDirectionStyle.headWidth);
  arrow.traverse((object) => {
    const material = (object as THREE.Mesh).material as THREE.Material | undefined;
    if (material) {
      material.depthTest = false;
      material.transparent = true;
      if ('fog' in material) material.fog = false;
    }
    object.renderOrder = 20;
  });
  // ArrowHelper shares geometries globally. Own them before disposing a drawing layer.
  arrow.line.geometry = arrow.line.geometry.clone();
  arrow.cone.geometry = arrow.cone.geometry.clone();
  group.add(arrow);
}
