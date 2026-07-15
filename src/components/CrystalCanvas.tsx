import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { crystals, type CrystalType, type DisplaySettings, type ModelStyle, type ModuleId } from '../data/crystals';
import {
  densityCellClippingPlaneSpecs,
  hcpCellAtoms,
  hcpCellOffset,
  hcpDensityContributions,
  hcpGapPositions,
  hcpGeometry,
  hcpTranslation,
  latticeGeometry,
  sectionClippingPlaneSpec,
  type ClippingPlaneSpec,
} from '../data/latticeGeometry';

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
  onCarbonGapType?: (type: 'octa' | 'tetra') => void;
}

export type Vec3Tuple = [number, number, number];

export interface Fcc111PackingSite {
  position: Vec3Tuple;
  role: 'corner' | 'face';
}

export function fcc111PackingSites(): Fcc111PackingSite[] {
  return [
    { position: [1, 0, 0], role: 'corner' },
    { position: [0, 1, 0], role: 'corner' },
    { position: [0, 0, 1], role: 'corner' },
    { position: [0.5, 0.5, 0], role: 'face' },
    { position: [0.5, 0, 0.5], role: 'face' },
    { position: [0, 0.5, 0.5], role: 'face' },
  ];
}

export function fcc110DirectionEndpoints(): [Vec3Tuple, Vec3Tuple] {
  return [[0, 1, 0], [1, 0, 0]];
}

export interface RenderAtom {
  position: THREE.Vector3;
  kind: 'base' | 'center' | 'face' | 'gap' | 'carbon';
  label?: string;
  highlight?: boolean;
}

interface DynamicClippingPlane {
  local: THREE.Plane;
  world: THREE.Plane;
}

export const atomVisualStyle = {
  baseColor: '#38bdf8',
  specularColor: '#ffffff',
  shininess: 64,
  bodyLiftColor: '#052d3b',
  bodyLiftIntensity: 0.5,
  cubicSchematicRadiusOverA: 0.5 / 3.6,
  hcpSchematicRadiusOverA: 0.5 / 1.8,
} as const;

const atomColor = new THREE.Color(atomVisualStyle.baseColor);
const highlightColor = new THREE.Color('#fff65c');
const faceColor = new THREE.Color(atomVisualStyle.baseColor);
const gapTetraColor = new THREE.Color('#45d27a');
const gapOctaColor = new THREE.Color('#f39a42');
const carbonColor = new THREE.Color('#aeb7c3');
const cellScale = latticeGeometry.FCC.worldA;

const cornerPositions: Vec3Tuple[] = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const fccFacePositions: Vec3Tuple[] = [[0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5]];
const bccCenterPositions: Vec3Tuple[] = [[0.5, 0.5, 0.5]];
const cubicEdges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const hcpBottom = hcpGeometry.ring.map(([x, y]) => new THREE.Vector3(x, y, -hcpGeometry.c / 2));
const hcpTop = hcpGeometry.ring.map(([x, y]) => new THREE.Vector3(x, y, hcpGeometry.c / 2));
const hcpBottomCenter = new THREE.Vector3(0, 0, -hcpGeometry.c / 2);
const hcpTopCenter = new THREE.Vector3(0, 0, hcpGeometry.c / 2);
const hcpMid = hcpGeometry.upperHoles.map(([x, y]) => new THREE.Vector3(x, y, 0));

export function atomRenderRadius(crystal: CrystalType, modelStyle: ModelStyle) {
  const geometry = latticeGeometry[crystal];
  const radiusOverA = crystal === 'HCP'
    ? atomVisualStyle.hcpSchematicRadiusOverA
    : atomVisualStyle.cubicSchematicRadiusOverA;
  return (modelStyle === 'rigid' ? geometry.atomRadiusOverA : radiusOverA) * geometry.worldA;
}

interface AtomMaterialOptions {
  opacity?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  clippingPlanes?: THREE.Plane[];
  side?: THREE.Side;
}

function createAtomMaterial(color: THREE.ColorRepresentation, options: AtomMaterialOptions = {}) {
  const opacity = options.opacity ?? 1;
  return new THREE.MeshPhongMaterial({
    color,
    specular: atomVisualStyle.specularColor,
    shininess: atomVisualStyle.shininess,
    emissive: options.emissive ?? '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: opacity < 1,
    opacity,
    clippingPlanes: options.clippingPlanes,
    side: options.side ?? THREE.FrontSide,
  });
}

export const CrystalCanvas = forwardRef<CrystalCanvasHandle, Props>(function CrystalCanvas({ crystal, activeModule, settings, carbonInserted, onCarbonChange, onCarbonGapType }, ref) {
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
  const [bravaisStep, setBravaisStep] = useState(0);
  const coordAnimRef = useRef<{ objects: THREE.Object3D[]; startTime: number }>({ objects: [], startTime: 0 });
  const centerPulseRef = useRef<THREE.Mesh | null>(null);
  const dynamicClippingRef = useRef<DynamicClippingPlane[]>([]);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { moduleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { carbonRef.current = carbonInserted; }, [carbonInserted]);
  useEffect(() => {
    setSelectedGapIndex(0);
    setBravaisStep(0);
    if (activeModule !== 'coordination') setCoordinationTarget(null);
  }, [activeModule, crystal]);

  useEffect(() => {
    if (activeModule !== 'carbon' || !onCarbonGapType) return;
    const octaLen = getGapPositions(crystal, 'octa').length;
    onCarbonGapType(selectedGapIndex >= octaLen ? 'tetra' : 'octa');
  }, [activeModule, crystal, selectedGapIndex, onCarbonGapType]);
  useEffect(() => { onCarbonChangeRef.current = onCarbonChange; }, [onCarbonChange]);

  useImperativeHandle(ref, () => ({
    resetView() {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      const repeat = settings.showSupercell || activeModule === 'bravais' || activeModule === 'coordination' ? 2 : 1;
      setDefaultCamera(camera, controls, crystal, repeat, activeModule);
      rootRef.current?.rotation.set(-0.12, 0.26, 0.03);
    },
    capture() {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const link = document.createElement('a');
      link.download = `crystal-${crystal.toLowerCase()}-${activeModule}.png`;
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    },
  }), [activeModule, crystal, settings.showSupercell]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070c, 8, 16);
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(4.5, 3.9, 5.4);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x05070c, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
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

    const ambient = new THREE.AmbientLight(0x708090, 1.35);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(5, 10, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rim.position.set(-5, -5, -5);
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
        rootRef.current.rotation.y += 0.006 * s.speed;
      }
      if (rootRef.current && dynamicClippingRef.current.length > 0) {
        rootRef.current.updateMatrixWorld(true);
        dynamicClippingRef.current.forEach(({ local, world }) => {
          world.copy(local).applyMatrix4(rootRef.current!.matrixWorld);
        });
      }
      const anim = coordAnimRef.current;
      if (anim.objects.length > 0) {
        const elapsed = (performance.now() - anim.startTime) / 1000;
        anim.objects.forEach((obj, i) => {
          const delay = i * 0.12;
          const t = Math.max(0, Math.min(1, (elapsed - delay) / 0.3));
          const eased = t * (2 - t);
          obj.scale.setScalar(eased);
          if ((obj as THREE.Mesh).material) {
            const mat = (obj as THREE.Mesh).material as THREE.Material;
            if ('opacity' in mat) (mat as THREE.MeshBasicMaterial).opacity = eased * 0.48;
          }
        });
      }
      const pulse = centerPulseRef.current;
      if (pulse) {
        const t = performance.now() / 1000;
        const scale = 1 + 0.12 * Math.sin(t * 3.5);
        pulse.scale.setScalar(scale);
        const mat = pulse.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.15 + 0.08 * Math.sin(t * 3.5);
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
    dynamicClippingRef.current = [];
    root.rotation.set(-0.12, 0.26, 0.03);

    const repeat = settings.showSupercell || activeModule === 'bravais' || activeModule === 'coordination' ? 2 : 1;
    const hcpBravaisStep = crystal === 'HCP' && activeModule === 'bravais' ? bravaisStep : -1;
    const isDensity = activeModule === 'density';
    const atoms = createAtoms(crystal, repeat, settings.exploded && !isDensity, activeModule, hcpBravaisStep);
    const radius = atomRenderRadius(crystal, settings.modelStyle);
    const focusTarget = activeModule === 'coordination' && coordinationTarget
      ? new THREE.Vector3(...coordinationTarget)
      : new THREE.Vector3(0, 0, 0);
    if (activeModule === 'coordination') markCoordinationFocus(atoms, focusTarget);

    const sectionSpec = settings.sectionView ? sectionClippingPlaneSpec() : null;
    const sectionPlanes = !isDensity && sectionSpec
      ? createDynamicClippingPlanes(root, [sectionSpec], dynamicClippingRef.current)
      : [];
    if (!isDensity) {
      if (settings.showCell) addCellFrames(root, crystal, repeat, activeModule === 'bravais');
      if (settings.modelStyle === 'ball-stick') addBonds(root, atoms, crystal, sectionPlanes);
      addAtoms(
        root,
        atoms,
        radius,
        settings.atomOpacity,
        settings.showLabels && !settings.sectionView,
        activeModule,
        pickablesRef.current,
        activeModule === 'bravais' ? repeat : 0,
        sectionPlanes,
      );
    }
    if (settings.showAxes) addAxes(root);
    if (activeModule === 'packing') addPacking(root, crystal);
    if (activeModule === 'coordination') {
      addCoordination(root, atoms, crystal, focusTarget, coordAnimRef, centerPulseRef);
    } else {
      coordAnimRef.current = { objects: [], startTime: 0 };
      centerPulseRef.current = null;
    }
    if (activeModule === 'tetra') addGaps(root, crystal, 'tetra', pickablesRef.current, selectedGapIndex);
    if (activeModule === 'octa') addGaps(root, crystal, 'octa', pickablesRef.current, selectedGapIndex);
    if (activeModule === 'carbon') addCarbon(root, crystal, carbonInserted, pickablesRef.current, selectedGapIndex);
    if (settings.sectionView) addSectionPlane(root, crystal);
    if (isDensity) addDensityAssembly(root, crystal, sectionSpec, dynamicClippingRef.current);
    if (hcpBravaisStep >= 0) addHcpBravaisLabels(root, hcpBravaisStep);
  }, [activeModule, bravaisStep, carbonInserted, coordinationTarget, crystal, selectedGapIndex, settings]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const repeat = settings.showSupercell || activeModule === 'bravais' || activeModule === 'coordination' ? 2 : 1;
    setDefaultCamera(camera, controls, crystal, repeat, activeModule);
  }, [activeModule, crystal, settings.showSupercell]);

  return (
    <div className="viewport-wrap">
      <div className="three-mount" ref={mountRef} />
      <div className="canvas-hint">
        <span><MouseGlyph />拖拽：旋转</span>
        <span><MouseGlyph />滚轮：缩放</span>
        <span><MouseGlyph />右键：平移</span>
      </div>
      <div className="legend-box">
        <Legend color={atomVisualStyle.baseColor} label="基体原子" />
        <Legend color="#fff65c" label="选中原子" />
        <Legend color="#45d27a" label="间隙位置（四面体）" />
        <Legend color="#f39a42" label="间隙位置（八面体）" />
        <Legend color="#aeb7c3" label="碳原子" />
      </div>
      {crystal === 'FCC' && activeModule === 'packing' && (
        <div className="packing-summary">
          <strong>{'{111}'} · {'<110>'}</strong>
          <span>面内原子：3 角点 + 3 面心</span>
        </div>
      )}
      <div className="crystal-caption">
        <strong>{crystals[crystal].type}</strong>
        <span>{crystals[crystal].title}</span>
      </div>
      <div className="interaction-tip">
        {settings.sectionView
          ? '真实截面已开启：半透明平面为裁切面，仅保留晶体局部 x ≥ 0 一侧。'
          : getCanvasInstruction(activeModule)}
      </div>
      {crystal === 'HCP' && activeModule === 'bravais' && (
        <div className="bravais-stepper">
          <button type="button" disabled={bravaisStep <= 0} onClick={() => setBravaisStep((s) => s - 1)}>◀ 上一步</button>
          <span>{['① 简单六方点阵', '② 双原子结构基元', '③ HCP 完整结构'][bravaisStep]}</span>
          <button type="button" disabled={bravaisStep >= 2} onClick={() => setBravaisStep((s) => s + 1)}>下一步 ▶</button>
        </div>
      )}
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
      const disposeMaterial = (item: THREE.Material) => {
        const map = (item as THREE.MeshBasicMaterial).map;
        map?.dispose();
        item.dispose();
      };
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    });
  }
}

function createDynamicClippingPlanes(group: THREE.Group, specs: ClippingPlaneSpec[], registry: DynamicClippingPlane[]) {
  group.updateMatrixWorld(true);
  return specs.map(({ normal, constant }) => {
    const local = new THREE.Plane(new THREE.Vector3(...normal), constant);
    const world = local.clone().applyMatrix4(group.matrixWorld);
    registry.push({ local, world });
    return world;
  });
}

export function createAtoms(crystal: CrystalType, repeat: number, exploded: boolean, moduleId: ModuleId, hcpBravaisStep = -1): RenderAtom[] {
  if (crystal === 'HCP') return createHcpAtoms(repeat, exploded, moduleId, hcpBravaisStep);
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

function createHcpAtoms(repeat: number, exploded: boolean, moduleId: ModuleId, hcpBravaisStep = -1): RenderAtom[] {
  const atoms: RenderAtom[] = [];
  const local = hcpCellAtoms(hcpBravaisStep !== 0);
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const offset = new THREE.Vector3(...hcpCellOffset(ix, iy, iz, repeat));
        local.forEach((site, siteIndex) => {
          const position = new THREE.Vector3(...site.position).add(offset);
          if (exploded) position.add(position.clone().normalize().multiplyScalar(0.36));
          const atom: RenderAtom = { position, kind: site.kind, label: String(atoms.length) };
          const firstCell = ix === 0 && iy === 0 && iz === 0;
          const basisA = site.kind === 'face' && site.position[2] < 0;
          const basisB = site.kind === 'center' && siteIndex === local.length - hcpMid.length;
          if (hcpBravaisStep === 1 && firstCell && (basisA || basisB)) atom.highlight = true;
          atoms.push(atom);
        });
      }
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

function addAtoms(group: THREE.Group, atoms: RenderAtom[], radius: number, opacity: number, showLabels: boolean, moduleId: ModuleId, pickables?: THREE.Object3D[], bravaisRepeat = 0, clippingPlanes: THREE.Plane[] = []) {
  const sphere = new THREE.SphereGeometry(radius, 32, 32);
  const totalPerCell = atoms.length / Math.max(1, bravaisRepeat ** 3 || 1);
  atoms.forEach((atom, index) => {
    let color = atom.kind === 'face' ? faceColor : atomColor;
    if (atom.highlight) color = highlightColor;
    const isFirstCell = bravaisRepeat > 0 && index < totalPerCell;
    const atomOpacity = bravaisRepeat > 0 && !isFirstCell ? 0.15 : opacity;
    const material = createAtomMaterial(color, {
      emissive: atom.highlight ? '#665900' : atomVisualStyle.bodyLiftColor,
      emissiveIntensity: atom.highlight ? 0.9 : atomVisualStyle.bodyLiftIntensity,
      opacity: atomOpacity,
      clippingPlanes,
      side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
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
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.18, 32, 16), new THREE.MeshBasicMaterial({ color: atom.highlight ? '#fff65c' : '#2b87ff', transparent: true, opacity: atom.highlight ? 0.18 : 0.06, clippingPlanes }));
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

function addBonds(group: THREE.Group, atoms: RenderAtom[], crystal: CrystalType, clippingPlanes: THREE.Plane[] = []) {
  const geometry = latticeGeometry[crystal];
  const threshold = 2 * geometry.atomRadiusOverA * geometry.worldA * 1.03;
  const bondRadius = 0.03;
  const material = new THREE.MeshPhysicalMaterial({ color: '#c8d8ee', transparent: true, opacity: 0.55, roughness: 0.5, metalness: 0.1, clippingPlanes });
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const distance = atoms[i].position.distanceTo(atoms[j].position);
      if (distance > 0.05 && distance < threshold) {
        const dir = atoms[j].position.clone().sub(atoms[i].position);
        const mid = atoms[i].position.clone().add(atoms[j].position).multiplyScalar(0.5);
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(bondRadius, bondRadius, distance, 8, 1), material);
        cylinder.position.copy(mid);
        cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        group.add(cylinder);
      }
    }
  }
}

function addCellFrames(group: THREE.Group, crystal: CrystalType, repeat: number, vivid: boolean) {
  if (crystal === 'HCP') {
    for (let ix = 0; ix < repeat; ix++) {
      for (let iy = 0; iy < repeat; iy++) {
        for (let iz = 0; iz < repeat; iz++) {
          const offset = new THREE.Vector3(...hcpCellOffset(ix, iy, iz, repeat));
          addHcpFrame(group, offset, vivid);
        }
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
  const bottom = hcpBottom.map((p) => p.clone().add(offset));
  const top = hcpTop.map((p) => p.clone().add(offset));
  const material = new THREE.LineBasicMaterial({ color: vivid ? '#7dd0ff' : '#eef5ff', transparent: true, opacity: vivid ? 0.54 : 0.72 });
  for (let i = 0; i < 6; i++) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([bottom[i], bottom[(i + 1) % 6]]), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top[i], top[(i + 1) % 6]]), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([bottom[i], top[i]]), material));
  }
}

function addHcpBravaisLabels(group: THREE.Group, step: number) {
  const stepNames = ['简单六方点阵节点', '双原子结构基元 Motif', 'HCP 完整结构'];
  const title = createTextSprite(stepNames[step], step === 1 ? '#fff65c' : '#7dd0ff', 28);
  title.position.set(0, 2.1, 0);
  title.scale.set(1.6, 0.34, 1);
  group.add(title);

  if (step === 1) {
    const basisAtoms = [hcpBottomCenter.clone(), hcpMid[0].clone()];
    basisAtoms.forEach((pos) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.02, 8, 48),
        new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.5 }),
      );
      ring.position.copy(pos);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(basisAtoms),
      new THREE.LineDashedMaterial({ color: '#fff65c', transparent: true, opacity: 0.5, dashSize: 0.08, gapSize: 0.05 }),
    );
    line.computeLineDistances();
    group.add(line);
    const motifLabel = createTextSprite('Motif: 2 原子基元', '#fff65c', 24);
    motifLabel.position.set(0, -1.4, 0);
    motifLabel.scale.set(1.2, 0.28, 1);
    group.add(motifLabel);
  }

  if (step === 0) {
    const note = createTextSprite('12 顶角 + 2 底面中心点 → 六方点阵节点', '#aebfd2', 22);
    note.position.set(0, -1.4, 0);
    note.scale.set(1.5, 0.28, 1);
    group.add(note);
  }

  if (step === 2) {
    const note = createTextSprite('A-B-A 层叠排列 → 六方密堆积', '#7dd0ff', 24);
    note.position.set(0, -1.4, 0);
    note.scale.set(1.3, 0.28, 1);
    group.add(note);
  }
}

function addPacking(group: THREE.Group, crystal: CrystalType) {
  const planeColor = crystal === 'BCC' ? '#f28a31' : crystal === 'HCP' ? '#35c86f' : '#3B82F6';
  const dirColor = '#EF4444';
  const planeOpacity = 0.6;
  let vertices: THREE.Vector3[];
  if (crystal === 'HCP') {
    vertices = hcpTop.map((point) => point.clone());
  } else if (crystal === 'BCC') {
    vertices = [cubicPoint([0, 0, 0], 1), cubicPoint([1, 1, 0], 1), cubicPoint([1, 1, 1], 1), cubicPoint([0, 0, 1], 1)];
  } else {
    vertices = [cubicPoint([1, 0, 0], 1), cubicPoint([0, 1, 0], 1), cubicPoint([0, 0, 1], 1)];
  }
  const material = new THREE.MeshBasicMaterial({ color: planeColor, transparent: true, opacity: planeOpacity, side: THREE.DoubleSide, depthWrite: false });
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  if (vertices.length === 3) geometry.setIndex([0, 1, 2]);
  else if (vertices.length === 4) geometry.setIndex([0, 1, 2, 0, 2, 3]);
  else {
    const indices: number[] = [];
    for (let i = 1; i < vertices.length - 1; i++) indices.push(0, i, i + 1);
    geometry.setIndex(indices);
  }
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, material));

  const expandedOffset = crystal === 'HCP'
    ? new THREE.Vector3(1.45, 0.45, 0.7)
    : crystal === 'FCC'
      ? new THREE.Vector3(2.2, 0.35, -1.8)
      : new THREE.Vector3(1.1, 0.72, 0.9);
  const expanded = new THREE.Mesh(
    geometry.clone(),
    new THREE.MeshBasicMaterial({ color: planeColor, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, wireframe: true }),
  );
  expanded.position.copy(expandedOffset);
  group.add(expanded);

  const centroid = vertices.reduce((sum, point) => sum.add(point.clone()), new THREE.Vector3()).multiplyScalar(1 / vertices.length);
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

  if (crystal === 'FCC') {
    const planeNormal = new THREE.Vector3(1, 1, 1).normalize();
    const ringRadius = latticeGeometry.FCC.atomRadiusOverA * latticeGeometry.FCC.worldA;
    fcc111PackingSites().forEach((site) => {
      const position = cubicPoint(site.position, 1);
      const color = site.role === 'face' ? '#fff65c' : '#7dd0ff';
      const opacity = site.role === 'face' ? 0.98 : 0.82;
      [position, position.clone().add(expandedOffset)].forEach((ringPosition) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(ringRadius, 0.026, 10, 64),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, fog: false }),
        );
        ring.position.copy(ringPosition).addScaledVector(planeNormal, 0.012);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), planeNormal);
        ring.renderOrder = 8;
        group.add(ring);
      });
    });

    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      const tubePath = new THREE.LineCurve3(a, b);
      const tubeGeo = new THREE.TubeGeometry(tubePath, 8, 0.04, 8, false);
      group.add(new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: dirColor })));
    }
    const [startFractional, endFractional] = fcc110DirectionEndpoints();
    const start = cubicPoint(startFractional, 1);
    const end = cubicPoint(endFractional, 1);
    const arrowShaft = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 12, 0.045, 10, false),
      new THREE.MeshBasicMaterial({ color: dirColor, transparent: true, opacity: 1, depthTest: false, fog: false }),
    );
    arrowShaft.renderOrder = 20;
    group.add(arrowShaft);
    const arrow = new THREE.ArrowHelper(end.clone().sub(start).normalize(), start, start.distanceTo(end), new THREE.Color(dirColor), 0.28, 0.16);
    arrow.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material | undefined;
      if (material) {
        material.depthTest = false;
        material.transparent = true;
        if ('fog' in material) material.fog = false;
      }
      object.renderOrder = 20;
    });
    group.add(arrow);
  } else if (crystal === 'BCC') {
    const start = cubicPoint([0, 0, 0], 1);
    const end = cubicPoint([1, 1, 1], 1);
    group.add(new THREE.ArrowHelper(end.clone().sub(start).normalize(), start, start.distanceTo(end), new THREE.Color(dirColor), 0.28, 0.16));
  } else {
    for (let i = 0; i < 6; i++) {
      const a = vertices[i], b = vertices[(i + 1) % 6];
      const tubePath = new THREE.LineCurve3(a, b);
      const tubeGeo = new THREE.TubeGeometry(tubePath, 8, 0.035, 8, false);
      group.add(new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: dirColor })));
    }
    const start = vertices[3].clone();
    const end = vertices[0].clone();
    group.add(new THREE.ArrowHelper(end.clone().sub(start).normalize(), start, start.distanceTo(end), new THREE.Color(dirColor), 0.28, 0.16));
  }

  if (crystal !== 'FCC') {
    const label = createTextSprite(`${crystals[crystal].densePlane} / ${crystals[crystal].denseDirection}`, '#ffffff', 32);
    label.position.set(0, 1.75, 1.65);
    label.scale.set(1.35, 0.38, 1);
    group.add(label);
  }

  const unfold = createTextSprite('剖面平移展开', '#dbe7ff', 28);
  unfold.position.copy(expandedCentroid.clone().add(new THREE.Vector3(0, 0.42, 0)));
  unfold.scale.set(1.1, 0.3, 1);
  group.add(unfold);
}

function positionKey(value: THREE.Vector3) {
  return value.toArray().map((coordinate) => Math.round(coordinate * 1000)).join(',');
}

function uniqueVectors(values: THREE.Vector3[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = positionKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function expandPeriodicAtoms(atoms: RenderAtom[], crystal: CrystalType) {
  const translations: THREE.Vector3[] = [];
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      for (let iz = -1; iz <= 1; iz++) {
        const translation = crystal === 'HCP'
          ? new THREE.Vector3(...hcpTranslation(ix, iy, iz))
          : new THREE.Vector3(ix * cellScale, iy * cellScale, iz * cellScale);
        translations.push(translation);
      }
    }
  }
  const expanded = atoms.flatMap((atom) => translations.map((translation): RenderAtom => ({
    ...atom,
    position: atom.position.clone().add(translation),
    highlight: false,
  })));
  const seen = new Set<string>();
  return expanded.filter((atom) => {
    const key = positionKey(atom.position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function coordinationShell(atoms: RenderAtom[], crystal: CrystalType, target: THREE.Vector3) {
  const candidates = expandPeriodicAtoms(atoms, crystal);
  const centerIndex = closestAtomIndex(candidates, target);
  if (centerIndex < 0) return null;
  const center = candidates[centerIndex].position;
  const centerKey = positionKey(center);
  const seen = new Set<string>([centerKey]);
  const nearest = candidates
    .map((atom, index) => ({ index, distance: atom.position.distanceTo(center), atom }))
    .filter((item) => item.distance > 0.1)
    .sort((a, b) => a.distance - b.distance)
    .filter((item) => {
      const k = positionKey(item.atom.position);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, crystals[crystal].coordination);
  return { center, nearest };
}

function addCoordination(group: THREE.Group, atoms: RenderAtom[], crystal: CrystalType, target: THREE.Vector3, coordAnimRef: React.MutableRefObject<{ objects: THREE.Object3D[]; startTime: number }>, centerPulseRef: React.MutableRefObject<THREE.Mesh | null>) {
  coordAnimRef.current = { objects: [], startTime: performance.now() };
  centerPulseRef.current = null;
  const shell = coordinationShell(atoms, crystal, target);
  if (!shell) return;
  const { center, nearest } = shell;

  const pulseHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 16),
    new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.18 }),
  );
  pulseHalo.position.copy(center);
  group.add(pulseHalo);
  centerPulseRef.current = pulseHalo;

  [0.44, 0.68, 0.92].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.01, 8, 96),
      new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.2 - index * 0.04 }),
    );
    ring.position.copy(center);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  });

  const animObjects: THREE.Object3D[] = [];
  nearest.forEach((item, index) => {
    const neighborGroup = new THREE.Group();
    neighborGroup.scale.setScalar(0);

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([center, item.atom.position]),
      new THREE.LineBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.48 }),
    );
    neighborGroup.add(line);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.48 }));
    sphere.position.copy(item.atom.position.clone().lerp(center, 0.12));
    neighborGroup.add(sphere);
    const label = createTextSprite(String(index + 1), '#fff65c', 30);
    label.position.copy(item.atom.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
    label.scale.setScalar(0.28);
    neighborGroup.add(label);

    group.add(neighborGroup);
    animObjects.push(neighborGroup);
  });
  coordAnimRef.current = { objects: animObjects, startTime: performance.now() };

  const tip = createTextSprite('点击任意原子切换中心', '#dbe7ff', 28);
  tip.position.copy(center.clone().add(new THREE.Vector3(0, 0.72, 0)));
  tip.scale.set(1.22, 0.32, 1);
  group.add(tip);
}

export function polyhedronEdges(vertices: THREE.Vector3[], center: THREE.Vector3, kind: 'tetra' | 'octa') {
  const allPairs: Array<[number, number]> = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) allPairs.push([i, j]);
  }
  if (kind === 'tetra') return allPairs;

  const oppositeCandidates = allPairs
    .map(([i, j]) => ({
      pair: [i, j] as [number, number],
      cosine: vertices[i].clone().sub(center).normalize().dot(vertices[j].clone().sub(center).normalize()),
    }))
    .sort((a, b) => a.cosine - b.cosine);
  const opposite = new Set<string>();
  const used = new Set<number>();
  for (const { pair: [i, j] } of oppositeCandidates) {
    if (used.has(i) || used.has(j)) continue;
    opposite.add(`${i}-${j}`);
    used.add(i);
    used.add(j);
    if (opposite.size === 3) break;
  }
  return allPairs.filter(([i, j]) => !opposite.has(`${i}-${j}`));
}

function addPolyhedronCage(group: THREE.Group, vertices: THREE.Vector3[], center: THREE.Vector3, kind: 'tetra' | 'octa', color: THREE.ColorRepresentation, opacity: number) {
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  geometry.setIndex(polyhedronEdges(vertices, center, kind).flat());
  group.add(new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  ));
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
      const surrounding = findSurroundingAtoms(crystal, position, kind);
      const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
      surrounding.forEach((atomPos) => {
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([position, atomPos]), lineMat));
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color }));
        dot.position.copy(atomPos);
        group.add(dot);
      });
      if (surrounding.length >= 3) addPolyhedronCage(group, surrounding, position, kind, color, 0.45);

      const label = createTextSprite(`${kind === 'tetra' ? 'T' : 'O'}${index + 1}  ${getGapLabel(crystal, kind, index)}`, '#ffffff', 28);
      label.position.copy(position.clone().add(new THREE.Vector3(0, 0.46, 0)));
      label.scale.set(1.26, 0.32, 1);
      group.add(label);
    }
  });
}

export function findSurroundingAtoms(crystal: CrystalType, gapPos: THREE.Vector3, kind: 'tetra' | 'octa'): THREE.Vector3[] {
  if (crystal === 'HCP') {
    const count = kind === 'tetra' ? 4 : 6;
    const baseLocal = hcpCellAtoms(true).map((site) => new THREE.Vector3(...site.position));
    const allAtoms: THREE.Vector3[] = [];
    for (let ix = -1; ix <= 1; ix++) {
      for (let iy = -1; iy <= 1; iy++) {
        for (let iz = -1; iz <= 1; iz++) {
          const offset = new THREE.Vector3(...hcpTranslation(ix, iy, iz));
          baseLocal.forEach((position) => allAtoms.push(position.clone().add(offset)));
        }
      }
    }
    return uniqueVectors(allAtoms)
      .map((a) => ({ pos: a, d: a.distanceTo(gapPos) }))
      .filter((a) => a.d > 0.01)
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((a) => a.pos);
  }
  const count = kind === 'tetra' ? 4 : 6;
  const allPositions: THREE.Vector3[] = [];
  const base = crystal === 'FCC'
    ? [...cornerPositions, ...fccFacePositions]
    : [...cornerPositions, ...bccCenterPositions];
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      for (let iz = -1; iz <= 1; iz++) {
        for (const p of base) {
          allPositions.push(cubicPoint([p[0] + ix, p[1] + iy, p[2] + iz], 1));
        }
      }
    }
  }
  return uniqueVectors(allPositions)
    .map((a) => ({ pos: a, d: a.distanceTo(gapPos) }))
    .filter((a) => a.d > 0.01)
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((a) => a.pos);
}

function addCarbon(group: THREE.Group, crystal: CrystalType, inserted: boolean, pickables: THREE.Object3D[], selectedIndex = 0) {
  const octaPositions = getGapPositions(crystal, 'octa');
  const tetraPositions = getGapPositions(crystal, 'tetra');
  const allGapPositions = [...octaPositions, ...tetraPositions];
  const normalizedIndex = allGapPositions.length ? Math.min(selectedIndex, allGapPositions.length - 1) : 0;
  const isTetra = normalizedIndex >= octaPositions.length;
  const gapKind: 'octa' | 'tetra' = isTetra ? 'tetra' : 'octa';
  const localIndex = isTetra ? normalizedIndex - octaPositions.length : normalizedIndex;

  octaPositions.forEach((pos, i) => {
    const sel = !isTetra && i === localIndex;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(sel ? 0.18 : 0.11, 24, 16),
      new THREE.MeshBasicMaterial({ color: gapOctaColor, transparent: true, opacity: sel ? 0.9 : 0.42 }),
    );
    sphere.position.copy(pos);
    sphere.userData.kind = 'gap-target';
    sphere.userData.gapIndex = i;
    group.add(sphere);
    pickables.push(sphere);
  });
  tetraPositions.forEach((pos, i) => {
    const sel = isTetra && i === localIndex;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(sel ? 0.16 : 0.09, 24, 16),
      new THREE.MeshBasicMaterial({ color: gapTetraColor, transparent: true, opacity: sel ? 0.9 : 0.35 }),
    );
    sphere.position.copy(pos);
    sphere.userData.kind = 'gap-target';
    sphere.userData.gapIndex = octaPositions.length + i;
    group.add(sphere);
    pickables.push(sphere);
  });

  const target = allGapPositions[normalizedIndex] ?? new THREE.Vector3(0, 0, 0);
  const position = inserted ? target.clone() : new THREE.Vector3(-2.3, 1.6, 1.2);

  if (inserted && isTetra) {
    const surrounding = findSurroundingAtoms(crystal, target, 'tetra');
    if (crystal === 'FCC') {
      surrounding.forEach((atomPos) => {
        const pushDir = atomPos.clone().sub(target).normalize();
        const pushed = atomPos.clone().add(pushDir.multiplyScalar(0.08 * latticeGeometry.FCC.worldA));
        const warnSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 24, 16),
          new THREE.MeshPhysicalMaterial({ color: '#ff5757', transparent: true, opacity: 0.68, emissive: '#ff2222', emissiveIntensity: 0.5 }),
        );
        warnSphere.position.copy(pushed);
        group.add(warnSphere);
      });
    }
    addPolyhedronCage(group, surrounding, target, 'tetra', crystal === 'FCC' ? '#ffaa00' : '#f7cf62', 0.85);
  }

  if (inserted && !isTetra) {
    const surrounding = findSurroundingAtoms(crystal, target, 'octa');
    const distortionAtoms = crystal === 'BCC'
      ? surrounding.slice().sort((a, b) => a.distanceTo(target) - b.distanceTo(target)).slice(0, 2)
      : surrounding;
    distortionAtoms.forEach((atomPos) => {
      const pushDir = atomPos.clone().sub(target).normalize();
      const amount = crystal === 'BCC' ? 0.06 : 0.02;
      const pushed = atomPos.clone().add(pushDir.multiplyScalar(amount * latticeGeometry[crystal].worldA));
      const gentleSphere = new THREE.Mesh(
        new THREE.SphereGeometry(crystal === 'BCC' ? 0.12 : 0.08, 16, 12),
        new THREE.MeshBasicMaterial({ color: gapOctaColor, transparent: true, opacity: 0.4 }),
      );
      gentleSphere.position.copy(pushed);
      group.add(gentleSphere);
    });
  }

  const carbon = new THREE.Mesh(
    new THREE.SphereGeometry(inserted ? 0.22 : 0.24, 32, 20),
    new THREE.MeshPhysicalMaterial({
      color: inserted && isTetra ? '#ff6666' : carbonColor,
      roughness: 0.38,
      metalness: 0.15,
      emissive: inserted ? (isTetra ? '#cc2222' : '#6f7f8b') : '#1f252c',
      emissiveIntensity: inserted ? 0.72 : 0.35,
    }),
  );
  carbon.position.copy(position);
  group.add(carbon);
  const cLabel = createTextSprite('C', inserted ? '#ffffff' : '#111827', 46);
  cLabel.position.copy(position.clone().add(new THREE.Vector3(0, 0.03, 0)));
  cLabel.scale.setScalar(0.36);
  group.add(cLabel);

  const { text: statusText, color: statusColor } = carbonStatus(crystal, inserted, isTetra, localIndex);
  const status = createTextSprite(statusText, statusColor, 28);
  status.position.copy(target.clone().add(new THREE.Vector3(0, inserted ? 0.7 : 0.55, 0)));
  status.scale.set(1.65, 0.34, 1);
  group.add(status);

  if (!inserted) {
    group.add(new THREE.ArrowHelper(target.clone().sub(position).normalize(), position, Math.max(0.35, position.distanceTo(target) - 0.25), carbonColor, 0.22, 0.12));
  }
}

export function carbonStatus(crystal: CrystalType, inserted: boolean, isTetra: boolean, localIndex: number) {
  if (!inserted) {
    return { text: '点击间隙放入 C 原子（橙色=八面体，绿色=四面体）', color: '#f5c38a' };
  }
  if (crystal === 'FCC' && isTetra) {
    return { text: 'FCC 四面体间隙较小，C 更倾向八面体间隙', color: '#ff7777' };
  }
  if (crystal === 'BCC' && isTetra) {
    return { text: 'BCC 四面体空隙较大，但 C 的八面体占位能更低', color: '#f7cf62' };
  }
  if (crystal === 'BCC') {
    return { text: 'BCC 八面体占位更稳定，并沿 <100> 引发 BCT 畸变', color: '#7dd0ff' };
  }
  if (crystal === 'HCP') {
    const gapKind = isTetra ? 'tetra' : 'octa';
    const gapName = isTetra ? '四面体间隙' : '八面体间隙';
    return {
      text: `HCP ${gapName} ${getGapLabel(crystal, gapKind, localIndex)}；仅作结构示意，碳嵌入实验未开放`,
      color: isTetra ? '#7de3a0' : '#f5c38a',
    };
  }
  return { text: `C -> 八面体间隙 ${getGapLabel(crystal, 'octa', localIndex)}`, color: '#7dd0ff' };
}

function addDensityAssembly(group: THREE.Group, crystal: CrystalType, sectionSpec: ClippingPlaneSpec | null, registry: DynamicClippingPlane[]) {
  const clipSpecs = [
    ...densityCellClippingPlaneSpecs(crystal),
    ...(sectionSpec ? [sectionSpec] : []),
  ];
  const clipPlanes = createDynamicClippingPlanes(group, clipSpecs, registry);
  if (crystal === 'HCP') {
    addDensityHcp(group, crystal, clipPlanes);
    return;
  }

  const radius = latticeGeometry[crystal].atomRadiusOverA * latticeGeometry[crystal].worldA;
  const sphere = new THREE.SphereGeometry(radius, 48, 32);
  const base = crystal === 'FCC'
    ? [...cornerPositions.map((p) => ({ p, kind: 'corner' as const })), ...fccFacePositions.map((p) => ({ p, kind: 'face' as const }))]
    : [...cornerPositions.map((p) => ({ p, kind: 'corner' as const })), ...bccCenterPositions.map((p) => ({ p, kind: 'center' as const }))];

  const accentColor = crystal === 'BCC' ? '#f28a31' : '#2aa7ff';
  base.forEach((atom) => {
    const pos = cubicPoint(atom.p, 1);
    const mat = createAtomMaterial(accentColor, {
      opacity: 0.82,
      clippingPlanes: clipPlanes,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.copy(pos);
    group.add(mesh);
  });

  const cellMat = new THREE.LineBasicMaterial({ color: '#eef5ff', transparent: true, opacity: 0.5 });
  const points = cornerPositions.map((p) => cubicPoint(p, 1));
  cubicEdges.forEach(([a, b]) => {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[a], points[b]]), cellMat));
  });

  const assemblyY = -2.2;
  const info = crystals[crystal];
  const cornerFraction = '1/8';
  const cornerCount = 8;
  const extraKind = crystal === 'FCC' ? '面心' : '体心';
  const extraFraction = crystal === 'FCC' ? '1/2' : '1';
  const extraCount = crystal === 'FCC' ? 6 : 1;
  const totalAtoms = info.atomsPerCell;

  const assembledSphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.45, 48, 32),
    createAtomMaterial(accentColor, { opacity: 0.85 }),
  );
  assembledSphere.position.set(0, assemblyY, 0);
  group.add(assembledSphere);

  const cornerPiece = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.22, 24, 16, 0, Math.PI / 2, 0, Math.PI / 2),
    createAtomMaterial(accentColor, { opacity: 0.7, side: THREE.DoubleSide }),
  );
  cornerPiece.position.set(-1.6, assemblyY, 0);
  group.add(cornerPiece);
  const cornerLabel = createOverlayTextSprite(`${cornerCount}×${cornerFraction}`, '#ffffff', 26);
  cornerLabel.position.set(-1.6, assemblyY - 0.4, 0);
  cornerLabel.scale.set(0.7, 0.22, 1);
  group.add(cornerLabel);

  if (crystal === 'FCC') {
    const facePiece = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.3, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      createAtomMaterial(faceColor, { opacity: 0.7, side: THREE.DoubleSide }),
    );
    facePiece.position.set(1.6, assemblyY, 0);
    group.add(facePiece);
    const faceLabel = createOverlayTextSprite(`${extraCount}×${extraFraction}`, '#ffffff', 26);
    faceLabel.position.set(1.6, assemblyY - 0.4, 0);
    faceLabel.scale.set(0.7, 0.22, 1);
    group.add(faceLabel);
  } else if (crystal === 'BCC') {
    const centerPieceBcc = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.32, 32, 24),
      createAtomMaterial(accentColor, { opacity: 0.75 }),
    );
    centerPieceBcc.position.set(1.6, assemblyY, 0);
    group.add(centerPieceBcc);
    const centerLabel = createOverlayTextSprite(`${extraCount}×${extraFraction}`, '#ffffff', 26);
    centerLabel.position.set(1.6, assemblyY - 0.4, 0);
    centerLabel.scale.set(0.7, 0.22, 1);
    group.add(centerLabel);
  }

  const arrows = [
    { from: new THREE.Vector3(-1.1, assemblyY, 0), to: new THREE.Vector3(-0.5, assemblyY, 0) },
    { from: new THREE.Vector3(0.5, assemblyY, 0), to: new THREE.Vector3(1.1, assemblyY, 0) },
  ];
  arrows.forEach(({ from, to }) => {
    const dir = to.clone().sub(from).normalize();
    group.add(new THREE.ArrowHelper(dir, from, from.distanceTo(to), new THREE.Color(accentColor), 0.1, 0.06));
  });

  const totalLabel = createOverlayTextSprite(
    `角点 ${cornerCount}×${cornerFraction} + ${extraKind} ${extraCount}×${extraFraction} = ${totalAtoms} → APF ${Math.round(info.apf * 100)}%`,
    '#ffffff',
    27,
  );
  totalLabel.position.set(0, 2.1, 0);
  totalLabel.scale.set(2, 0.34, 1);
  group.add(totalLabel);
}

function addDensityHcp(group: THREE.Group, crystal: CrystalType, clippingPlanes: THREE.Plane[]) {
  const color = '#39c36e';
  const info = crystals[crystal];
  const radius = latticeGeometry.HCP.atomRadiusOverA * latticeGeometry.HCP.worldA;
  const sphere = new THREE.SphereGeometry(radius, 48, 32);
  hcpCellAtoms(true).forEach((site) => {
    const siteColor = site.kind === 'base' ? color : site.kind === 'face' ? '#7dd0ff' : '#fff65c';
    const mesh = new THREE.Mesh(
      sphere,
      createAtomMaterial(siteColor, {
        opacity: 0.84,
        clippingPlanes,
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...site.position);
    group.add(mesh);
  });
  addHcpFrame(group, new THREE.Vector3(), true);

  const heading = createOverlayTextSprite(`12×1/6 + 2×1/2 + 3×1 = 6 → APF ${Math.round(info.apf * 100)}%`, '#ffffff', 28);
  heading.position.set(0, 2.15, 0.2);
  heading.scale.set(2, 0.34, 1);
  group.add(heading);

  const contributions = hcpDensityContributions();
  const labels = ['角点 12×1/6 = 2', '底面心 2×1/2 = 1', '柱内 3×1 = 3'];
  const colors = [color, '#7dd0ff', '#fff65c'];
  contributions.forEach((contribution, index) => {
    const x = (index - 1) * 1.7;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 24, 16),
      createAtomMaterial(colors[index]),
    );
    marker.position.set(x, -2.05, 0);
    group.add(marker);
    const label = createOverlayTextSprite(labels[index], colors[index], 23);
    label.position.set(x, -2.42, 0);
    label.scale.set(1.08, 0.27, 1);
    group.add(label);
    marker.userData.effectiveAtoms = contribution.effective;
  });

}

function addSectionPlane(group: THREE.Group, crystal: CrystalType) {
  const geometry = crystal === 'HCP'
    ? new THREE.PlaneGeometry(hcpGeometry.c * 1.2, hcpGeometry.a * 2.15)
    : new THREE.PlaneGeometry(cellScale * 1.15, cellScale * 1.15);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#8ceaff', transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.y = Math.PI / 2;
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

export function getGapPositions(crystal: CrystalType, kind: 'tetra' | 'octa') {
  if (crystal === 'HCP') {
    return hcpGapPositions(kind).map((position) => new THREE.Vector3(...position));
  }
  if (crystal === 'FCC') {
    if (kind === 'tetra') {
      return [[0.25,0.25,0.25],[0.75,0.25,0.25],[0.25,0.75,0.25],[0.25,0.25,0.75],
              [0.75,0.75,0.25],[0.75,0.25,0.75],[0.25,0.75,0.75],[0.75,0.75,0.75]].map((p) => cubicPoint(p as Vec3Tuple, 1));
    }
    return [
      [0.5,0.5,0.5],
      [0.5,0,0],[0.5,1,0],[0.5,0,1],[0.5,1,1],
      [0,0.5,0],[1,0.5,0],[0,0.5,1],[1,0.5,1],
      [0,0,0.5],[1,0,0.5],[0,1,0.5],[1,1,0.5],
    ].map((p) => cubicPoint(p as Vec3Tuple, 1));
  }
  if (kind === 'tetra') {
    return [
      [0.5,0.25,0],[0.5,0.75,0],[0.25,0.5,0],[0.75,0.5,0],
      [0.5,0.25,1],[0.5,0.75,1],[0.25,0.5,1],[0.75,0.5,1],
      [0,0.5,0.25],[0,0.5,0.75],[0,0.25,0.5],[0,0.75,0.5],
      [1,0.5,0.25],[1,0.5,0.75],[1,0.25,0.5],[1,0.75,0.5],
      [0.5,0,0.25],[0.5,0,0.75],[0.25,0,0.5],[0.75,0,0.5],
      [0.5,1,0.25],[0.5,1,0.75],[0.25,1,0.5],[0.75,1,0.5],
    ].map((p) => cubicPoint(p as Vec3Tuple, 1));
  }
  return [
    [0.5,0.5,0],[0.5,0.5,1],[0.5,0,0.5],[0.5,1,0.5],[0,0.5,0.5],[1,0.5,0.5],
    [0.5,0,0],[0.5,1,0],[0.5,0,1],[0.5,1,1],
    [0,0.5,0],[1,0.5,0],[0,0.5,1],[1,0.5,1],
    [0,0,0.5],[1,0,0.5],[0,1,0.5],[1,1,0.5],
  ].map((p) => cubicPoint(p as Vec3Tuple, 1));
}

function getGapLabel(crystal: CrystalType, kind: 'tetra' | 'octa', index: number) {
  if (crystal === 'HCP') {
    if (kind === 'tetra') {
      const dir = index % 2 === 0 ? '下指' : '上指';
      return `层间${dir} T${index + 1} [12/cell]`;
    }
    return `层间八面体 O${index + 1} [6/cell]`;
  }
  if (crystal === 'FCC') {
    if (kind === 'tetra') {
      const labels = ['(1/4,1/4,1/4)','(3/4,1/4,1/4)','(1/4,3/4,1/4)','(1/4,1/4,3/4)','(3/4,3/4,1/4)','(3/4,1/4,3/4)','(1/4,3/4,3/4)','(3/4,3/4,3/4)'];
      return (labels[index] ?? `T${index+1}`) + ' [8/cell]';
    }
    const labels = ['体心(1/2,1/2,1/2)',
      '棱(1/2,0,0)','棱(1/2,1,0)','棱(1/2,0,1)','棱(1/2,1,1)',
      '棱(0,1/2,0)','棱(1,1/2,0)','棱(0,1/2,1)','棱(1,1/2,1)',
      '棱(0,0,1/2)','棱(1,0,1/2)','棱(0,1,1/2)','棱(1,1,1/2)'];
    return (labels[index] ?? `O${index+1}`) + ' [有效4/cell]';
  }
  if (kind === 'tetra') {
    return `T${index+1} [有效12/cell]`;
  }
  const labels = [
    '面心(1/2,1/2,0)','面心(1/2,1/2,1)','面心(1/2,0,1/2)','面心(1/2,1,1/2)','面心(0,1/2,1/2)','面心(1,1/2,1/2)',
    '棱(1/2,0,0)','棱(1/2,1,0)','棱(1/2,0,1)','棱(1/2,1,1)',
    '棱(0,1/2,0)','棱(1,1/2,0)','棱(0,1/2,1)','棱(1,1/2,1)',
    '棱(0,0,1/2)','棱(1,0,1/2)','棱(0,1,1/2)','棱(1,1,1/2)'];
  return (labels[index] ?? `O${index+1}`) + ' [有效6/cell]';
}

function getCanvasInstruction(moduleId: ModuleId) {
  const copy: Record<ModuleId, string> = {
    cell: '三种球模型可切换，观察原子与晶胞框线。',
    bravais: '2×2×2 阵列已展开，观察同一格点在相邻晶胞中的平移重复。',
    packing: '半透明面是密排面，右侧虚影表示剖面平移展开，箭头表示密排方向。',
    coordination: '点击任意基体原子，重新计算中心原子的最近邻与配位数。',
    density: '裁切环和拼合碎片示意 APF 计算过程，右侧柱状图同步读数。',
    tetra: '点击绿色间隙小球，查看对应四面体间隙与包围线框。',
    octa: '点击橙色间隙小球，查看对应八面体间隙与包围线框。',
    carbon: '点击橙色（八面体）或绿色（四面体）间隙，把灰色 C 原子嵌入目标位置。',
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
  const measure = canvas.getContext('2d')!;
  measure.font = `700 ${size}px Inter, system-ui, sans-serif`;
  const padding = 28;
  canvas.width = Math.max(128, Math.min(1024, Math.ceil(measure.measureText(text).width + padding * 2)));
  canvas.height = Math.max(72, Math.ceil(size * 2.2));
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set((canvas.width / canvas.height) * 0.3, 0.3, 1);
  return sprite;
}

function createOverlayTextSprite(text: string, color = '#ffffff', size = 36) {
  const sprite = createTextSprite(text, color, size);
  sprite.renderOrder = 30;
  return sprite;
}

function setDefaultCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, crystal: CrystalType, repeat: number, activeModule: ModuleId) {
  const baseDistance = crystal === 'HCP'
    ? (repeat > 1 ? 13.2 : 9.2)
    : (repeat > 1 ? 10.8 : 8.1);
  const distance = crystal === 'FCC' && activeModule === 'packing' ? 10.5 : baseDistance;
  const target = crystal === 'FCC' && activeModule === 'packing'
    ? new THREE.Vector3(0.55, 0.08, -0.42)
    : new THREE.Vector3(0, 0, 0);
  camera.position.set(target.x + distance * 0.56, target.y + distance * 0.48, target.z + distance * 0.67);
  controls.target.copy(target);
  controls.update();
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
