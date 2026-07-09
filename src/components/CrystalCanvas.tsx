import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { crystals, type CrystalType, type DisplaySettings, type ModuleId } from '../data/crystals';

export interface CrystalCanvasHandle {
  resetView: () => void;
  capture: () => void;
}

interface Props {
  crystal: CrystalType;
  activeModule: ModuleId;
  settings: DisplaySettings;
  carbonInserted: boolean;
  onCarbonChange: (value: boolean) => void;
}

type Vec3Tuple = [number, number, number];

interface RenderAtom {
  position: THREE.Vector3;
  kind: 'base' | 'center' | 'face' | 'gap' | 'carbon';
  label?: string;
  highlight?: boolean;
}

const atomColor = new THREE.Color('#777cff');
const highlightColor = new THREE.Color('#fff65c');
const faceColor = new THREE.Color('#7b82ff');
const gapTetraColor = new THREE.Color('#45d27a');
const gapOctaColor = new THREE.Color('#f39a42');
const carbonColor = new THREE.Color('#aeb7c3');
const cellScale = 2.65;

const cornerPositions: Vec3Tuple[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const fccFacePositions: Vec3Tuple[] = [[0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5]];
const bccCenterPositions: Vec3Tuple[] = [[0.5, 0.5, 0.5]];
const cubicEdges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const hcpBottom = hexRing(-0.72);
const hcpTop = hexRing(0.72);
const hcpMid = [new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(-0.36, -0.21, 0), new THREE.Vector3(0.36, -0.21, 0)];

function hexRing(z: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + (index * Math.PI) / 3;
    return new THREE.Vector3(Math.cos(angle) * 1.08, Math.sin(angle) * 1.08, z);
  });
}

export const CrystalCanvas = forwardRef<CrystalCanvasHandle, Props>(function CrystalCanvas({ crystal, activeModule, settings, carbonInserted, onCarbonChange }, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const settingsRef = useRef(settings);
  const moduleRef = useRef(activeModule);
  const carbonRef = useRef(carbonInserted);
  const onCarbonChangeRef = useRef(onCarbonChange);
  const [coordinationTarget, setCoordinationTarget] = useState<Vec3Tuple | null>(null);
  const [selectedGapIndex, setSelectedGapIndex] = useState(0);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { moduleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { carbonRef.current = carbonInserted; }, [carbonInserted]);
  useEffect(() => {
    setSelectedGapIndex(0);
    if (activeModule !== 'coordination') setCoordinationTarget(null);
  }, [activeModule, crystal]);
  useEffect(() => { onCarbonChangeRef.current = onCarbonChange; }, [onCarbonChange]);

  useImperativeHandle(ref, () => ({
    resetView() {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      camera.position.set(4.5, 3.9, 5.4);
      controls.target.set(0, 0, 0);
      controls.update();
    },
    capture() {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const link = document.createElement('a');
      link.download = `crystal-${crystal.toLowerCase()}-${activeModule}.png`;
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    },
  }), [activeModule, crystal]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07111d, 8, 16);
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(4.5, 3.9, 5.4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x07111d, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;
    controls.maxDistance = 14;
    controlsRef.current = controls;

    const root = new THREE.Group();
    rootRef.current = root;
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xc7d6ff, 1.55);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(4, 7, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x2aa7ff, 3.5, 12);
    rim.position.set(-3, 1.2, 3);
    scene.add(rim);

    const bg = createBackgroundPlane();
    scene.add(bg);

    const resizeObserver = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    resizeObserver.observe(mount);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent) => {
      const currentModule = moduleRef.current;
      if (!['carbon', 'coordination', 'tetra', 'octa'].includes(currentModule)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickablesRef.current, true);

      if (currentModule === 'coordination') {
        const atomHit = hits.find((hit) => hit.object.userData.kind === 'coordination-atom');
        const point = atomHit?.object.userData.coordPosition as number[] | undefined;
        if (point) setCoordinationTarget([point[0], point[1], point[2]]);
        return;
      }

      const gapHit = hits.find((hit) => hit.object.userData.kind === 'gap-target');
      if (!gapHit) return;
      const index = Number(gapHit.object.userData.gapIndex ?? 0);
      setSelectedGapIndex(index);
      if (currentModule === 'carbon') onCarbonChangeRef.current(true);
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      const s = settingsRef.current;
      if (s.autoRotate && rootRef.current) {
        rootRef.current.rotation.y += 0.006 * Math.max(0.2, s.speed);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    clearGroup(root);
    pickablesRef.current = [];
    root.rotation.set(-0.12, 0.26, 0.03);

    const repeat = settings.showSupercell || activeModule === 'bravais' || activeModule === 'coordination' ? 2 : 1;
    const atoms = createAtoms(crystal, repeat, settings.exploded || activeModule === 'density', activeModule);
    const radius = settings.modelStyle === 'rigid' ? (crystal === 'HCP' ? 0.34 : 0.31) : 0.18;
    const focusTarget = activeModule === 'coordination' && coordinationTarget
      ? new THREE.Vector3(...coordinationTarget)
      : new THREE.Vector3(0, 0, 0);
    if (activeModule === 'coordination') markCoordinationFocus(atoms, focusTarget);

    if (settings.showCell) addCellFrames(root, crystal, repeat, activeModule === 'bravais');
    if (settings.modelStyle === 'ball-stick') addBonds(root, atoms, crystal, repeat);
    addAtoms(root, atoms, radius, settings.atomOpacity, settings.showLabels, activeModule, pickablesRef.current);
    if (settings.showAxes) addAxes(root);
    if (activeModule === 'packing') addPacking(root, crystal);
    if (activeModule === 'coordination') addCoordination(root, atoms, crystal, focusTarget);
    if (activeModule === 'tetra') addGaps(root, crystal, 'tetra', pickablesRef.current, selectedGapIndex);
    if (activeModule === 'octa') addGaps(root, crystal, 'octa', pickablesRef.current, selectedGapIndex);
    if (activeModule === 'carbon') addCarbon(root, crystal, carbonInserted, pickablesRef.current, selectedGapIndex);
    if (settings.sectionView) addSectionPlane(root, crystal);
    if (activeModule === 'density') addDensityAssembly(root, crystal);
  }, [activeModule, carbonInserted, coordinationTarget, crystal, selectedGapIndex, settings]);

  return (
    <div className="viewport-wrap">
      <div className="three-mount" ref={mountRef} />
      <div className="canvas-hint">
        <span><MouseGlyph />拖拽：旋转</span>
        <span><MouseGlyph />滚轮：缩放</span>
        <span><MouseGlyph />右键：平移</span>
      </div>
      <div className="legend-box">
        <Legend color="#7b82ff" label="基体原子" />
        <Legend color="#fff65c" label="选中原子" />
        <Legend color="#45d27a" label="间隙位置（四面体）" />
        <Legend color="#f39a42" label="间隙位置（八面体）" />
        <Legend color="#aeb7c3" label="碳原子" />
      </div>
      <div className="crystal-caption">
        <strong>{crystals[crystal].type}</strong>
        <span>{crystals[crystal].title}</span>
      </div>
      <div className="interaction-tip">{getCanvasInstruction(activeModule)}</div>
    </div>
  );
});

function clearGroup(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children.pop()!;
    child.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    });
  }
}

function createAtoms(crystal: CrystalType, repeat: number, exploded: boolean, moduleId: ModuleId): RenderAtom[] {
  if (crystal === 'HCP') return createHcpAtoms(repeat, exploded, moduleId);
  const base = crystal === 'FCC'
    ? [...cornerPositions.map((p) => ({ p, kind: 'base' as const })), ...fccFacePositions.map((p) => ({ p, kind: 'face' as const }))]
    : [...cornerPositions.map((p) => ({ p, kind: 'base' as const })), ...bccCenterPositions.map((p) => ({ p, kind: 'center' as const }))];
  const atoms: RenderAtom[] = [];
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        for (const atom of base) {
          const position = cubicPoint([atom.p[0] + ix, atom.p[1] + iy, atom.p[2] + iz], repeat);
          if (exploded) position.add(position.clone().normalize().multiplyScalar(0.42));
          atoms.push({ position, kind: atom.kind, label: String(atoms.length) });
        }
      }
    }
  }
  if (moduleId === 'coordination') {
    const closest = closestAtomIndex(atoms, new THREE.Vector3(0, 0, 0));
    if (closest >= 0) atoms[closest].highlight = true;
  }
  return atoms;
}

function createHcpAtoms(repeat: number, exploded: boolean, moduleId: ModuleId): RenderAtom[] {
  const atoms: RenderAtom[] = [];
  const cell = 2.4;
  const centers: THREE.Vector3[] = [];
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      const offset = new THREE.Vector3((ix - (repeat - 1) / 2) * cell, (iy - (repeat - 1) / 2) * cell * 0.88, 0);
      centers.push(offset);
      const local = [...hcpBottom, ...hcpTop, ...hcpMid];
      local.forEach((p) => {
        const position = p.clone().multiplyScalar(1.15).add(offset);
        if (exploded) position.add(position.clone().normalize().multiplyScalar(0.36));
        atoms.push({ position, kind: Math.abs(p.z) < 0.1 ? 'center' : 'base', label: String(atoms.length) });
      });
    }
  }
  if (moduleId === 'coordination') {
    const closest = closestAtomIndex(atoms, new THREE.Vector3(0, 0, 0));
    if (closest >= 0) atoms[closest].highlight = true;
  }
  return atoms;
}

function cubicPoint(point: Vec3Tuple, repeat: number) {
  return new THREE.Vector3((point[0] - repeat / 2) * cellScale, (point[1] - repeat / 2) * cellScale, (point[2] - repeat / 2) * cellScale);
}

function markCoordinationFocus(atoms: RenderAtom[], target: THREE.Vector3) {
  atoms.forEach((atom) => { atom.highlight = false; });
  const closest = closestAtomIndex(atoms, target);
  if (closest >= 0) atoms[closest].highlight = true;
}

function addAtoms(group: THREE.Group, atoms: RenderAtom[], radius: number, opacity: number, showLabels: boolean, moduleId: ModuleId, pickables?: THREE.Object3D[]) {
  const sphere = new THREE.SphereGeometry(radius, 48, 32);
  atoms.forEach((atom, index) => {
    let color = atom.kind === 'face' ? faceColor : atomColor;
    if (atom.highlight) color = highlightColor;
    const material = new THREE.MeshPhysicalMaterial({
      color,
      emissive: atom.highlight ? '#665900' : '#111847',
      emissiveIntensity: atom.highlight ? 0.9 : 0.24,
      metalness: 0.05,
      roughness: 0.28,
      transmission: 0,
      transparent: opacity < 1,
      opacity,
    });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.copy(atom.position);
    mesh.castShadow = false;
    if (moduleId === 'coordination' && pickables) {
      mesh.userData.kind = 'coordination-atom';
      mesh.userData.coordPosition = atom.position.toArray();
      pickables.push(mesh);
    }
    group.add(mesh);

    if (atom.highlight || (moduleId === 'coordination' && index % 2 === 0)) {
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.18, 32, 16), new THREE.MeshBasicMaterial({ color: atom.highlight ? '#fff65c' : '#2b87ff', transparent: true, opacity: atom.highlight ? 0.18 : 0.06 }));
      halo.position.copy(atom.position);
      group.add(halo);
    }
    if (showLabels) {
      const sprite = createTextSprite(atom.highlight ? '0' : atom.label ?? String(index), atom.highlight ? '#fff45a' : '#dbe7ff', atom.highlight ? 52 : 34);
      sprite.position.copy(atom.position.clone().add(new THREE.Vector3(0, radius * 0.18, 0)));
      sprite.scale.setScalar(atom.highlight ? 0.54 : 0.34);
      group.add(sprite);
    }
  });
}

function addBonds(group: THREE.Group, atoms: RenderAtom[], crystal: CrystalType, repeat: number) {
  const threshold = crystal === 'BCC' ? 2.36 : crystal === 'HCP' ? 1.35 : 1.9;
  const material = new THREE.LineBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.42 });
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const distance = atoms[i].position.distanceTo(atoms[j].position);
      if (distance > 0.05 && distance < threshold / Math.max(1, repeat * 0.18)) {
        const geometry = new THREE.BufferGeometry().setFromPoints([atoms[i].position, atoms[j].position]);
        group.add(new THREE.Line(geometry, material));
      }
    }
  }
}

function addCellFrames(group: THREE.Group, crystal: CrystalType, repeat: number, vivid: boolean) {
  if (crystal === 'HCP') {
    for (let ix = 0; ix < repeat; ix++) {
      for (let iy = 0; iy < repeat; iy++) {
        const offset = new THREE.Vector3((ix - (repeat - 1) / 2) * 2.4, (iy - (repeat - 1) / 2) * 2.12, 0);
        addHcpFrame(group, offset, vivid);
      }
    }
    return;
  }
  const material = new THREE.LineBasicMaterial({ color: vivid ? '#7dd0ff' : '#eef5ff', transparent: true, opacity: vivid ? 0.55 : 0.72 });
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const points = cornerPositions.map((p) => cubicPoint([p[0] + ix, p[1] + iy, p[2] + iz], repeat));
        cubicEdges.forEach(([a, b]) => {
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[a], points[b]]), material));
        });
      }
    }
  }
}

function addHcpFrame(group: THREE.Group, offset: THREE.Vector3, vivid: boolean) {
  const bottom = hcpBottom.map((p) => p.clone().multiplyScalar(1.15).add(offset));
  const top = hcpTop.map((p) => p.clone().multiplyScalar(1.15).add(offset));
  const material = new THREE.LineBasicMaterial({ color: vivid ? '#7dd0ff' : '#eef5ff', transparent: true, opacity: vivid ? 0.54 : 0.72 });
  for (let i = 0; i < 6; i++) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([bottom[i], bottom[(i + 1) % 6]]), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top[i], top[(i + 1) % 6]]), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([bottom[i], top[i]]), material));
  }
}

function addPacking(group: THREE.Group, crystal: CrystalType) {
  const planeColor = crystal === 'BCC' ? '#f28a31' : crystal === 'HCP' ? '#35c86f' : '#2aa7ff';
  const material = new THREE.MeshBasicMaterial({ color: planeColor, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
  let vertices: THREE.Vector3[];
  if (crystal === 'HCP') {
    vertices = hcpMid.map((p) => p.clone().multiplyScalar(1.55));
  } else if (crystal === 'BCC') {
    vertices = [cubicPoint([0, 0, 0.5], 1), cubicPoint([1, 0, 0.5], 1), cubicPoint([1, 1, 0.5], 1), cubicPoint([0, 1, 0.5], 1)];
  } else {
    vertices = [cubicPoint([1, 0, 0], 1), cubicPoint([0, 1, 0], 1), cubicPoint([0, 0, 1], 1)];
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  if (vertices.length === 3) geometry.setIndex([0, 1, 2]);
  else geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();

  const plane = new THREE.Mesh(geometry, material);
  group.add(plane);

  const expandedOffset = crystal === 'HCP' ? new THREE.Vector3(1.45, 0.45, 0.7) : new THREE.Vector3(1.1, 0.72, 0.9);
  const expanded = new THREE.Mesh(
    geometry.clone(),
    new THREE.MeshBasicMaterial({ color: planeColor, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, wireframe: true }),
  );
  expanded.position.copy(expandedOffset);
  group.add(expanded);

  const centroid = vertices.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / vertices.length);
  const expandedCentroid = centroid.clone().add(expandedOffset);
  const unfoldLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([centroid, expandedCentroid]),
    new THREE.LineDashedMaterial({ color: planeColor, transparent: true, opacity: 0.68, dashSize: 0.08, gapSize: 0.05 }),
  );
  unfoldLine.computeLineDistances();
  group.add(unfoldLine);

  vertices.forEach((point) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), new THREE.MeshBasicMaterial({ color: planeColor }));
    dot.position.copy(point);
    group.add(dot);
    const ghost = dot.clone();
    ghost.position.copy(point.clone().add(expandedOffset));
    ghost.scale.setScalar(0.9);
    group.add(ghost);
  });

  const arrowDir = crystal === 'BCC' ? new THREE.Vector3(1, 1, 1).normalize() : crystal === 'HCP' ? new THREE.Vector3(1, 0, 0).normalize() : new THREE.Vector3(1, -1, 0).normalize();
  const arrowOrigin = centroid.clone().add(arrowDir.clone().multiplyScalar(-0.95));
  const arrow = new THREE.ArrowHelper(arrowDir, arrowOrigin, 2.15, new THREE.Color(planeColor), 0.28, 0.16);
  group.add(arrow);

  const label = createTextSprite(`${crystals[crystal].densePlane} / ${crystals[crystal].denseDirection}`, '#ffffff', 32);
  label.position.set(0, 1.75, 1.65);
  label.scale.set(1.35, 0.38, 1);
  group.add(label);

  const unfold = createTextSprite('剖面平移展开', '#dbe7ff', 28);
  unfold.position.copy(expandedCentroid.clone().add(new THREE.Vector3(0, 0.42, 0)));
  unfold.scale.set(1.1, 0.3, 1);
  group.add(unfold);
}

function addCoordination(group: THREE.Group, atoms: RenderAtom[], crystal: CrystalType, target: THREE.Vector3) {
  const centerIndex = closestAtomIndex(atoms, target);
  if (centerIndex < 0) return;
  const center = atoms[centerIndex].position;
  const nearest = atoms
    .map((atom, index) => ({ index, distance: atom.position.distanceTo(center), atom }))
    .filter((item) => item.index !== centerIndex && item.distance > 0.1)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, crystals[crystal].coordination);

  [0.44, 0.68, 0.92].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.01, 8, 96),
      new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.2 - index * 0.04 }),
    );
    ring.position.copy(center);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  });

  nearest.forEach((item, index) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([center, item.atom.position]),
      new THREE.LineBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.48 }),
    );
    group.add(line);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), new THREE.MeshBasicMaterial({ color: '#fff65c' }));
    sphere.position.copy(item.atom.position.clone().lerp(center, 0.12));
    group.add(sphere);
    const label = createTextSprite(String(index + 1), '#fff65c', 30);
    label.position.copy(item.atom.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
    label.scale.setScalar(0.28);
    group.add(label);
  });

  const tip = createTextSprite('点击任意原子切换中心', '#dbe7ff', 28);
  tip.position.copy(center.clone().add(new THREE.Vector3(0, 0.72, 0)));
  tip.scale.set(1.22, 0.32, 1);
  group.add(tip);
}

function addGaps(group: THREE.Group, crystal: CrystalType, kind: 'tetra' | 'octa', pickables: THREE.Object3D[], selectedIndex = 0) {
  const positions = getGapPositions(crystal, kind);
  const color = kind === 'tetra' ? gapTetraColor : gapOctaColor;
  const normalizedIndex = positions.length ? Math.min(selectedIndex, positions.length - 1) : 0;
  positions.forEach((position, index) => {
    const selected = index === normalizedIndex;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(selected ? 0.18 : 0.11, 24, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: selected ? 0.9 : 0.42 }),
    );
    sphere.position.copy(position);
    sphere.userData.kind = 'gap-target';
    sphere.userData.gapIndex = index;
    group.add(sphere);
    pickables.push(sphere);
    if (selected) {
      const cage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(kind === 'tetra' ? 0.72 : 0.86, 0),
        new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.58 }),
      );
      cage.position.copy(position);
      group.add(cage);

      const label = createTextSprite(`${kind === 'tetra' ? 'T' : 'O'}${index + 1}  ${getGapLabel(crystal, kind, index)}`, '#ffffff', 28);
      label.position.copy(position.clone().add(new THREE.Vector3(0, 0.46, 0)));
      label.scale.set(1.26, 0.32, 1);
      group.add(label);
    }
  });
}

function addCarbon(group: THREE.Group, crystal: CrystalType, inserted: boolean, pickables: THREE.Object3D[], selectedIndex = 0) {
  const octaPositions = getGapPositions(crystal, 'octa');
  const normalizedIndex = octaPositions.length ? Math.min(selectedIndex, octaPositions.length - 1) : 0;
  addGaps(group, crystal, 'octa', pickables, normalizedIndex);
  const target = octaPositions[normalizedIndex] ?? new THREE.Vector3(0, 0, 0);
  const position = inserted ? target.clone() : new THREE.Vector3(-2.3, 1.6, 1.2);
  const carbon = new THREE.Mesh(
    new THREE.SphereGeometry(inserted ? 0.22 : 0.24, 32, 20),
    new THREE.MeshPhysicalMaterial({
      color: carbonColor,
      roughness: 0.38,
      metalness: 0.15,
      emissive: inserted ? '#6f7f8b' : '#1f252c',
      emissiveIntensity: inserted ? 0.72 : 0.35,
    }),
  );
  carbon.position.copy(position);
  group.add(carbon);
  const label = createTextSprite('C', inserted ? '#ffffff' : '#111827', 46);
  label.position.copy(position.clone().add(new THREE.Vector3(0, 0.03, 0)));
  label.scale.setScalar(0.36);
  group.add(label);

  const status = createTextSprite(inserted ? `C -> 八面体间隙 ${getGapLabel(crystal, 'octa', normalizedIndex)}` : '点击橙色间隙放入 C 原子', '#f5c38a', 28);
  status.position.copy(target.clone().add(new THREE.Vector3(0, inserted ? 0.7 : 0.55, 0)));
  status.scale.set(1.45, 0.34, 1);
  group.add(status);

  if (!inserted) {
    group.add(new THREE.ArrowHelper(target.clone().sub(position).normalize(), position, Math.max(0.35, position.distanceTo(target) - 0.25), carbonColor, 0.22, 0.12));
  }
}

function addDensityAssembly(group: THREE.Group, crystal: CrystalType) {
  const color = crystal === 'BCC' ? '#f28a31' : crystal === 'HCP' ? '#39c36e' : '#2aa7ff';
  const torus = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.015, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.76 }));
  torus.rotation.x = Math.PI / 2;
  group.add(torus);

  const fragmentMaterial = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.68, roughness: 0.24, metalness: 0.05, emissive: color, emissiveIntensity: 0.18 });
  const fragments = [
    new THREE.Vector3(-1.45, -1.65, 1.05),
    new THREE.Vector3(-0.75, -1.65, 1.05),
    new THREE.Vector3(-0.05, -1.65, 1.05),
    new THREE.Vector3(0.65, -1.65, 1.05),
  ];
  fragments.forEach((position, index) => {
    const part = new THREE.Mesh(new THREE.SphereGeometry(0.16 + index * 0.012, 24, 14, 0, Math.PI * 1.12), fragmentMaterial);
    part.position.copy(position);
    part.rotation.set(index * 0.28, index * 0.18, 0.2);
    group.add(part);
    if (index < fragments.length - 1) {
      group.add(new THREE.ArrowHelper(fragments[index + 1].clone().sub(position).normalize(), position.clone().add(new THREE.Vector3(0.18, 0, 0)), 0.36, new THREE.Color(color), 0.08, 0.05));
    }
  });

  const label = createTextSprite(`APF ${Math.round(crystals[crystal].apf * 100)}%`, '#ffffff', 38);
  label.position.set(0, -1.85, 1.4);
  label.scale.set(1.1, 0.35, 1);
  group.add(label);

  const assembly = createTextSprite('晶胞内原子碎片裁切拼合', '#dbe7ff', 26);
  assembly.position.set(-0.4, -2.05, 0.72);
  assembly.scale.set(1.42, 0.32, 1);
  group.add(assembly);
}

function addSectionPlane(group: THREE.Group, crystal: CrystalType) {
  const geometry = crystal === 'HCP' ? new THREE.CircleGeometry(1.65, 6) : new THREE.PlaneGeometry(3.5, 3.5);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#8ceaff', transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.set(crystal === 'HCP' ? 0 : Math.PI / 4, 0.32, crystal === 'HCP' ? Math.PI / 6 : -0.32);
  group.add(mesh);
}

function addAxes(group: THREE.Group) {
  const origin = new THREE.Vector3(-2.45, -2.1, -1.7);
  const x = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, 0.62, 0xff554f, 0.13, 0.08);
  const y = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, 0.62, 0x3bd56f, 0.13, 0.08);
  const z = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, 0.62, 0x4385ff, 0.13, 0.08);
  group.add(x, y, z);
  const lx = createTextSprite('X', '#ff554f', 28); lx.position.copy(origin.clone().add(new THREE.Vector3(0.78, 0, 0))); lx.scale.setScalar(0.24);
  const ly = createTextSprite('Y', '#3bd56f', 28); ly.position.copy(origin.clone().add(new THREE.Vector3(0, 0.78, 0))); ly.scale.setScalar(0.24);
  const lz = createTextSprite('Z', '#4385ff', 28); lz.position.copy(origin.clone().add(new THREE.Vector3(0, 0, 0.78))); lz.scale.setScalar(0.24);
  group.add(lx, ly, lz);
}

function getGapPositions(crystal: CrystalType, kind: 'tetra' | 'octa') {
  if (crystal === 'HCP') {
    return kind === 'tetra'
      ? [new THREE.Vector3(0, 0.35, 0.36), new THREE.Vector3(-0.46, -0.2, -0.36), new THREE.Vector3(0.46, -0.2, 0.36)]
      : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0, -0.62, 0)];
  }
  if (kind === 'tetra') {
    return [[0.25, 0.25, 0.25], [0.75, 0.25, 0.25], [0.25, 0.75, 0.25], [0.25, 0.25, 0.75], [0.75, 0.75, 0.25], [0.75, 0.25, 0.75], [0.25, 0.75, 0.75], [0.75, 0.75, 0.75]].map((p) => cubicPoint(p as Vec3Tuple, 1));
  }
  const octa = crystal === 'FCC'
    ? [[0.5, 0.5, 0.5], [0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [1, 0.5, 0.5], [0.5, 1, 0.5]]
    : [[0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5], [0.5, 0.5, 1], [1, 0.5, 0.5], [0.5, 1, 0.5]];
  return octa.map((p) => cubicPoint(p as Vec3Tuple, 1));
}

function getGapLabel(crystal: CrystalType, kind: 'tetra' | 'octa', index: number) {
  if (crystal === 'HCP') {
    const labels = kind === 'tetra'
      ? ['层间四面体孔 A', '层间四面体孔 B', '层间四面体孔 C']
      : ['层间八面体孔 O1', '上层三角孔 O2', '下层三角孔 O3'];
    return labels[index] ?? labels[0];
  }
  if (kind === 'tetra') {
    const labels = ['(1/4,1/4,1/4)', '(3/4,1/4,1/4)', '(1/4,3/4,1/4)', '(1/4,1/4,3/4)', '(3/4,3/4,1/4)', '(3/4,1/4,3/4)', '(1/4,3/4,3/4)', '(3/4,3/4,3/4)'];
    return labels[index] ?? labels[0];
  }
  const fccLabels = ['(1/2,1/2,1/2)', '(1/2,0,0)', '(0,1/2,0)', '(0,0,1/2)', '(1,1/2,1/2)', '(1/2,1,1/2)'];
  const bccLabels = ['(1/2,1/2,0)', '(1/2,0,1/2)', '(0,1/2,1/2)', '(1/2,1/2,1)', '(1,1/2,1/2)', '(1/2,1,1/2)'];
  const labels = crystal === 'FCC' ? fccLabels : bccLabels;
  return labels[index] ?? labels[0];
}

function getCanvasInstruction(moduleId: ModuleId) {
  const copy: Record<ModuleId, string> = {
    cell: '切换刚性球 / 球棍模型，观察原子与晶胞框线的空间关系。',
    bravais: '2×2×2 阵列已展开，观察同一格点在相邻晶胞中的平移重复。',
    packing: '半透明面是密排面，右侧虚影表示剖面平移展开，箭头表示密排方向。',
    coordination: '点击任意基体原子，重新计算中心原子的最近邻与配位数。',
    density: '裁切环和拼合碎片示意 APF 计算过程，右侧柱状图同步读数。',
    tetra: '点击绿色间隙小球，查看对应四面体间隙与包围线框。',
    octa: '点击橙色间隙小球，查看对应八面体间隙与包围线框。',
    carbon: '点击橙色八面体间隙，把灰色 C 原子放入目标间隙。',
  };
  return copy[moduleId];
}

function closestAtomIndex(atoms: RenderAtom[], target: THREE.Vector3) {
  let min = Infinity;
  let index = -1;
  atoms.forEach((atom, atomIndex) => {
    const d = atom.position.distanceTo(target);
    if (d < min) {
      min = d;
      index = atomIndex;
    }
  });
  return index;
}

function createTextSprite(text: string, color = '#ffffff', size = 36) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.8, 0.3, 1);
  return sprite;
}

function createBackgroundPlane() {
  const geometry = new THREE.PlaneGeometry(18, 12, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: '#07111d', transparent: true, opacity: 1 });
  const plane = new THREE.Mesh(geometry, material);
  plane.position.set(0, 0, -5.5);
  return plane;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span><i style={{ background: color }} />{label}</span>;
}

function MouseGlyph() {
  return <span className="mouse-dot" />;
}
