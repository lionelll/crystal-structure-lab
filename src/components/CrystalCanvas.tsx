import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { crystals, resolveCrystal, type CrystalType, type DisplaySettings, type ModelStyle, type ModuleId } from '../data/crystals';
import {
  hcpCellAtoms,
  hcpCellOffset,
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

export function bcc111DirectionEndpoints(): [Vec3Tuple, Vec3Tuple] {
  return [[0, 0, 0], [1, 1, 1]];
}

export interface RenderAtom {
  position: THREE.Vector3;
  kind: 'base' | 'center' | 'face';
  highlight?: boolean;
}

interface DynamicClippingPlane {
  local: THREE.Plane;
  world: THREE.Plane;
}

interface GapSelectionContext {
  layer: THREE.Group;
  crystal: CrystalType;
  kind: 'tetra' | 'octa';
  positions: THREE.Vector3[];
  renderedAtoms: RenderAtom[];
  renderedAtomKeys: Set<string>;
  repeat: number;
  atomRadius: number;
}

interface CoordinationSelectionContext {
  layer: THREE.Group;
  frameGroup: THREE.Group;
  crystal: CrystalType;
  atoms: RenderAtom[];
  atomMeshes: Map<string, THREE.Mesh>;
  radius: number;
  renderedAtomKeys: Set<string>;
  showSupercell: boolean;
}

export const atomVisualStyle = {
  baseColor: '#38bdf8',
  specularColor: '#888888',
  shininess: 80,
  bodyLiftColor: '#052d3b',
  bodyLiftIntensity: 0.5,
  keyLightIntensity: 1.8,
  cubicSchematicRadiusOverA: 0.5 / 3.6,
  hcpSchematicRadiusOverA: ((0.5 / 3.6) * latticeGeometry.FCC.worldA) / latticeGeometry.HCP.worldA,
  ballStickRadiusScale: 0.6,
  bondRadius: 0.025,
} as const;

export const AUTO_ROTATE_RADIANS_PER_FRAME = 0.003;
export const COORDINATION_TRANSITION_MS = 450;

export function coordinationTransitionEase(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 - Math.pow(1 - clamped, 3);
}

export const coordinationVisualStyle = {
  centerColor: '#fff65c',
  neighborColor: '#ff4f57',
  baseColor: atomVisualStyle.baseColor,
} as const;

export const bravaisPointStyle = {
  color: '#7dd0ff',
  size: 0.095,
} as const;

export const packingDirectionStyle = {
  shaftRadius: 0.018,
  headLength: 0.34,
  headWidth: 0.19,
} as const;

export const packingPlaneColor = '#3B82F6';

export function sceneStructureKey(crystal: CrystalType, activeModule: ModuleId, settings: DisplaySettings) {
  return [
    crystal,
    activeModule,
    settings.modelStyle,
    settings.showSupercell,
    settings.exploded,
    settings.sectionView,
  ].join('|');
}

export interface CrystalAxisVector {
  label: string;
  direction: Vec3Tuple;
  color: number;
}

export function crystalAxisVectors(crystal: CrystalType): CrystalAxisVector[] {
  if (crystal === 'HCP') {
    return [
      { label: 'a₁', direction: [1, 0, 0], color: 0xff554f },
      { label: 'a₂', direction: [-0.5, Math.sqrt(3) / 2, 0], color: 0x3bd56f },
      { label: 'a₃', direction: [-0.5, -Math.sqrt(3) / 2, 0], color: 0xffa43a },
      { label: 'c', direction: [0, 0, 1], color: 0x4385ff },
    ];
  }
  return [
    { label: 'X', direction: [1, 0, 0], color: 0xff554f },
    { label: 'Y', direction: [0, 1, 0], color: 0x3bd56f },
    { label: 'Z', direction: [0, 0, 1], color: 0x4385ff },
  ];
}

export type StackingLayerLabel = 'A' | 'B' | 'C';

export function stackingSequence(crystal: CrystalType): StackingLayerLabel[] {
  if (crystal === 'FCC') return ['A', 'B', 'C', 'A'];
  return ['A', 'B', 'A'];
}

export function cellFrameRepeat(crystal: CrystalType, activeModule: ModuleId, hasCoordinationTarget: boolean, showSupercell: boolean) {
  if (activeModule === 'stacking') return 1;
  if (showSupercell) return 2;
  return activeModule === 'coordination' && hasCoordinationTarget ? 2 : 1;
}

const atomColor = new THREE.Color(atomVisualStyle.baseColor);
const highlightColor = new THREE.Color('#fff65c');
const faceColor = new THREE.Color(atomVisualStyle.baseColor);
const gapTetraColor = new THREE.Color('#45d27a');
const gapOctaColor = new THREE.Color('#f39a42');
const coordinationNeighborColor = new THREE.Color(coordinationVisualStyle.neighborColor);
const coordinationBaseColor = new THREE.Color(coordinationVisualStyle.baseColor);
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

export function atomRenderRadius(crystal: CrystalType, modelStyle: ModelStyle) {
  const geometry = latticeGeometry[crystal];
  const radiusOverA = crystal === 'HCP'
    ? atomVisualStyle.hcpSchematicRadiusOverA
    : atomVisualStyle.cubicSchematicRadiusOverA;
  if (modelStyle === 'rigid') return geometry.atomRadiusOverA * geometry.worldA;
  const referenceRadius = radiusOverA * geometry.worldA;
  return modelStyle === 'ball-stick'
    ? referenceRadius * atomVisualStyle.ballStickRadiusScale
    : referenceRadius;
}

export function stackingAtomRadius(crystal: CrystalType) {
  return atomRenderRadius(crystal, 'schematic');
}

export function stackingPositionScale(crystal: CrystalType) {
  const geometry = latticeGeometry[crystal];
  const rigidRadius = geometry.atomRadiusOverA * geometry.worldA;
  return stackingAtomRadius(crystal) / rigidRadius;
}

const interstitialModules = new Set<ModuleId>(['tetra', 'octa']);

export function atomOpacityForModule(
  moduleId: ModuleId,
) {
  return interstitialModules.has(moduleId) ? 0.42 : 1;
}

interface AtomMaterialOptions {
  opacity?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  clippingPlanes?: THREE.Plane[];
  side?: THREE.Side;
  fog?: boolean;
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
    ...(options.clippingPlanes ? { clippingPlanes: options.clippingPlanes } : {}),
    side: options.side ?? THREE.FrontSide,
    fog: options.fog ?? true,
  });
}

export const CrystalCanvas = forwardRef<CrystalCanvasHandle, Props>(function CrystalCanvas({ crystal: crystalValue, activeModule, settings }, ref) {
  const crystal = resolveCrystal(crystalValue).type;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const settingsRef = useRef(settings);
  const moduleRef = useRef(activeModule);
  const [coordinationTarget, setCoordinationTarget] = useState<Vec3Tuple | null>(null);
  const [selectedGapIndex, setSelectedGapIndex] = useState(0);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const coordAnimRef = useRef<{ objects: THREE.Object3D[]; startTime: number }>({ objects: [], startTime: 0 });
  const centerPulseRef = useRef<THREE.Mesh | null>(null);
  const dynamicClippingRef = useRef<DynamicClippingPlane[]>([]);
  const coordinationFrameGroupRef = useRef<THREE.Group | null>(null);
  const gapSelectionContextRef = useRef<GapSelectionContext | null>(null);
  const coordinationSelectionContextRef = useRef<CoordinationSelectionContext | null>(null);
  const cameraTransitionFrameRef = useRef<number | null>(null);
  const structureKey = sceneStructureKey(crystal, activeModule, settings);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { moduleRef.current = activeModule; }, [activeModule]);
  useEffect(() => {
    setSelectedGapIndex(0);
    if (activeModule !== 'coordination') setCoordinationTarget(null);
  }, [activeModule, crystal]);

  useImperativeHandle(ref, () => ({
    resetView() {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      if (cameraTransitionFrameRef.current !== null) cancelAnimationFrame(cameraTransitionFrameRef.current);
      cameraTransitionFrameRef.current = null;
      const repeat = cellFrameRepeat(crystal, activeModule, Boolean(coordinationTarget), settings.showSupercell);
      setDefaultCamera(camera, controls, crystal, repeat, activeModule);
      setCellFrameGroupProgress(coordinationFrameGroupRef.current, 1);
      rootRef.current?.rotation.set(0, 0, 0);
    },
    capture() {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const link = document.createElement('a');
      link.download = `crystal-${crystal.toLowerCase()}-${activeModule}.png`;
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    },
  }), [activeModule, coordinationTarget, crystal, settings.showSupercell]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070c, 8, 16);
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.up.set(0, 0, 1);
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
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setRenderError(new Error('WebGL context lost.'));
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3.2;
    controls.maxDistance = 18;
    controlsRef.current = controls;

    const root = new THREE.Group();
    rootRef.current = root;
    scene.add(root);

    const ambient = new THREE.AmbientLight(0x708090, 1.35);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, atomVisualStyle.keyLightIntensity);
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
      if (!['coordination', 'tetra', 'octa'].includes(currentModule)) return;
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
        rootRef.current.rotation.z += AUTO_ROTATE_RADIANS_PER_FRAME;
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
      try {
        renderer.render(scene, camera);
      } catch (error) {
        disposed = true;
        cancelAnimationFrame(frame);
        setRenderError(error instanceof Error ? error : new Error('Three.js rendering failed.'));
      }
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (cameraTransitionFrameRef.current !== null) cancelAnimationFrame(cameraTransitionFrameRef.current);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
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
    coordinationFrameGroupRef.current = null;
    gapSelectionContextRef.current = null;
    coordinationSelectionContextRef.current = null;

    const repeat = settings.showSupercell ? 2 : 1;
    const standaloneModule = activeModule === 'bravais' || activeModule === 'stacking';
    const atoms = standaloneModule
      ? []
      : createAtoms(crystal, repeat, settings.exploded, activeModule);
    const radius = atomRenderRadius(crystal, settings.modelStyle);
    const renderedAtomKeys = new Set(atoms.map((atom) => positionKey(atom.position)));
    const sectionSpec = settings.sectionView ? sectionClippingPlaneSpec() : null;
    const sectionPlanes = sectionSpec
      ? createDynamicClippingPlanes(root, [sectionSpec], dynamicClippingRef.current)
      : [];
    const frameRepeat = cellFrameRepeat(crystal, activeModule, Boolean(coordinationTarget), settings.showSupercell);
    const frameGroup = new THREE.Group();
    if (activeModule !== 'stacking') addCellFrames(frameGroup, crystal, frameRepeat, activeModule === 'bravais');
    const animateCoordinationFrames = activeModule === 'coordination'
      && Boolean(coordinationTarget)
      && !settings.showSupercell;
    if (animateCoordinationFrames) setCellFrameGroupProgress(frameGroup, 0);
    root.add(frameGroup);
    coordinationFrameGroupRef.current = frameGroup;
    if (activeModule === 'stacking') {
      addStackingModel(root, crystal);
    } else if (activeModule === 'bravais') {
      addBravaisSites(root, createBravaisSites(crystal, repeat), sectionPlanes);
    } else {
      if (settings.modelStyle === 'ball-stick') addBonds(root, atoms, crystal, sectionPlanes);
      const atomMeshes = activeModule === 'coordination' ? new Map<string, THREE.Mesh>() : undefined;
      addAtoms(
        root,
        atoms,
        radius,
        atomOpacityForModule(activeModule),
        activeModule,
        pickablesRef.current,
        sectionPlanes,
        atomMeshes,
      );
      if (activeModule === 'coordination' && atomMeshes) {
        const layer = new THREE.Group();
        root.add(layer);
        const context: CoordinationSelectionContext = {
          layer,
          frameGroup,
          crystal,
          atoms,
          atomMeshes,
          radius,
          renderedAtomKeys,
          showSupercell: settings.showSupercell,
        };
        coordinationSelectionContextRef.current = context;
        updateCoordinationSelection(context, coordinationTarget, coordAnimRef, centerPulseRef);
        setCellFrameGroupProgress(frameGroup, 1);
      }
    }
    addAxes(root, crystal);
    if (activeModule === 'packing') addPacking(root, crystal);
    if (activeModule !== 'coordination') {
      coordAnimRef.current = { objects: [], startTime: 0 };
      centerPulseRef.current = null;
    }
    if (activeModule === 'tetra' || activeModule === 'octa') {
      const { positions } = addGapTargets(root, crystal, activeModule, repeat, pickablesRef.current);
      const layer = new THREE.Group();
      root.add(layer);
      const context: GapSelectionContext = {
        layer,
        crystal,
        kind: activeModule,
        positions,
        renderedAtoms: atoms,
        renderedAtomKeys,
        repeat,
        atomRadius: radius,
      };
      gapSelectionContextRef.current = context;
      renderGapSelectionLayer(
        layer,
        crystal,
        activeModule,
        positions,
        atoms,
        selectedGapIndex,
        repeat,
        radius,
        renderedAtomKeys,
      );
    }
    if (settings.sectionView) addSectionPlane(root, crystal);
  }, [structureKey]);

  useEffect(() => {
    const context = gapSelectionContextRef.current;
    if (!context) return;
    renderGapSelectionLayer(
      context.layer,
      context.crystal,
      context.kind,
      context.positions,
      context.renderedAtoms,
      selectedGapIndex,
      context.repeat,
      context.atomRadius,
      context.renderedAtomKeys,
    );
  }, [selectedGapIndex]);

  useEffect(() => {
    const context = coordinationSelectionContextRef.current;
    if (!context) return;
    updateCoordinationSelection(context, coordinationTarget, coordAnimRef, centerPulseRef);
  }, [coordinationTarget]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const repeat = cellFrameRepeat(crystal, activeModule, Boolean(coordinationTarget), settings.showSupercell);
    rootRef.current?.rotation.set(0, 0, 0);
    if (cameraTransitionFrameRef.current !== null) cancelAnimationFrame(cameraTransitionFrameRef.current);
    cameraTransitionFrameRef.current = null;

    setDefaultCamera(camera, controls, crystal, repeat, activeModule);
    setCellFrameGroupProgress(coordinationFrameGroupRef.current, 1);
  }, [activeModule, crystal, settings.showSupercell]);

  useEffect(() => {
    if (activeModule !== 'coordination') return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (cameraTransitionFrameRef.current !== null) cancelAnimationFrame(cameraTransitionFrameRef.current);
    cameraTransitionFrameRef.current = null;

    const repeat = cellFrameRepeat(crystal, activeModule, Boolean(coordinationTarget), settings.showSupercell);
    if (!coordinationTarget || settings.showSupercell) {
      setDefaultCamera(camera, controls, crystal, repeat, activeModule);
      setCellFrameGroupProgress(coordinationFrameGroupRef.current, 1);
      return;
    }

    const preset = cameraPreset(crystal, repeat, activeModule);
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startUp = camera.up.clone();
    const endPosition = new THREE.Vector3(...preset.position);
    const endTarget = new THREE.Vector3(...preset.target);
    const endUp = new THREE.Vector3(...preset.up);
    const startTime = performance.now();
    const transition = (now: number) => {
      const progress = Math.min(1, (now - startTime) / COORDINATION_TRANSITION_MS);
      const eased = coordinationTransitionEase(progress);
      camera.position.lerpVectors(startPosition, endPosition, eased);
      camera.up.lerpVectors(startUp, endUp, eased).normalize();
      controls.target.lerpVectors(startTarget, endTarget, eased);
      controls.update();
      setCellFrameGroupProgress(coordinationFrameGroupRef.current, eased);
      if (progress < 1) cameraTransitionFrameRef.current = requestAnimationFrame(transition);
      else cameraTransitionFrameRef.current = null;
    };
    cameraTransitionFrameRef.current = requestAnimationFrame(transition);
    return () => {
      if (cameraTransitionFrameRef.current !== null) cancelAnimationFrame(cameraTransitionFrameRef.current);
      cameraTransitionFrameRef.current = null;
    };
  }, [coordinationTarget]);

  if (renderError) throw renderError;

  return (
    <div className="viewport-wrap">
      <div className="three-mount" ref={mountRef} />
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

export function createAtoms(crystal: CrystalType, repeat: number, exploded: boolean, moduleId: ModuleId): RenderAtom[] {
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
          atoms.push({ position, kind: atom.kind });
        }
      }
    }
  }
  return finalizeAtoms(atoms, moduleId);
}

function createHcpAtoms(repeat: number, exploded: boolean, moduleId: ModuleId): RenderAtom[] {
  const atoms: RenderAtom[] = [];
  const local = hcpCellAtoms(true);
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const offset = new THREE.Vector3(...hcpCellOffset(ix, iy, iz, repeat));
        local.forEach((site) => {
          const position = new THREE.Vector3(...site.position).add(offset);
          if (exploded) position.add(position.clone().normalize().multiplyScalar(0.36));
          atoms.push({ position, kind: site.kind });
        });
      }
    }
  }
  return finalizeAtoms(atoms, moduleId);
}

function finalizeAtoms(atoms: RenderAtom[], moduleId: ModuleId) {
  const unique = deduplicateAtoms(atoms);
  if (moduleId !== 'coordination') unique.forEach((atom) => { atom.highlight = false; });
  return unique;
}

export function deduplicateAtoms(atoms: RenderAtom[]) {
  const seen = new Set<string>();
  return atoms.filter((atom) => {
    const key = positionKey(atom.position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createBravaisSites(crystal: CrystalType, repeat: number): RenderAtom[] {
  const sites: RenderAtom[] = [];
  if (crystal === 'HCP') {
    const local = hcpCellAtoms(false);
    for (let ix = 0; ix < repeat; ix++) {
      for (let iy = 0; iy < repeat; iy++) {
        for (let iz = 0; iz < repeat; iz++) {
          const offset = new THREE.Vector3(...hcpCellOffset(ix, iy, iz, repeat));
          local.forEach((site) => sites.push({ position: new THREE.Vector3(...site.position).add(offset), kind: site.kind }));
        }
      }
    }
  } else {
    const local = crystal === 'FCC'
      ? [...cornerPositions.map((p) => ({ p, kind: 'base' as const })), ...fccFacePositions.map((p) => ({ p, kind: 'face' as const }))]
      : [...cornerPositions.map((p) => ({ p, kind: 'base' as const })), ...bccCenterPositions.map((p) => ({ p, kind: 'center' as const }))];
    for (let ix = 0; ix < repeat; ix++) {
      for (let iy = 0; iy < repeat; iy++) {
        for (let iz = 0; iz < repeat; iz++) {
          local.forEach((site) => sites.push({
            position: cubicPoint([site.p[0] + ix, site.p[1] + iy, site.p[2] + iz], repeat),
            kind: site.kind,
          }));
        }
      }
    }
  }
  return deduplicateAtoms(sites);
}

export interface StackingAtom {
  position: THREE.Vector3;
  layer: StackingLayerLabel;
}

function stackingLayerCoordinate(crystal: CrystalType, position: THREE.Vector3) {
  return crystal === 'FCC' ? position.x + position.y + position.z : position.z;
}

export function createStackingAtoms(crystal: CrystalType): StackingAtom[] {
  const cellAtoms = createAtoms(crystal, 1, false, 'cell');
  const layerLevels = [...new Set(cellAtoms.map(({ position }) => stackingLayerCoordinate(crystal, position).toFixed(6)))]
    .map(Number)
    .sort((a, b) => a - b);
  const sequence = stackingSequence(crystal);

  return cellAtoms.map(({ position }) => {
    const coordinate = stackingLayerCoordinate(crystal, position);
    const layerIndex = layerLevels.reduce((closest, value, index) => (
      Math.abs(value - coordinate) < Math.abs(layerLevels[closest] - coordinate) ? index : closest
    ), 0);
    const stackingPosition = position.clone().multiplyScalar(stackingPositionScale(crystal));
    return { position: stackingPosition, layer: sequence[layerIndex] };
  });
}

function addStackingModel(group: THREE.Group, crystal: CrystalType) {
  const atoms = createStackingAtoms(crystal);
  const atomRadius = stackingAtomRadius(crystal);
  const sphere = new THREE.SphereGeometry(atomRadius, 32, 24);
  const material = createAtomMaterial(atomVisualStyle.baseColor, {
    emissive: atomVisualStyle.bodyLiftColor,
    emissiveIntensity: atomVisualStyle.bodyLiftIntensity,
    fog: false,
  });
  atoms.forEach((atom) => {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.copy(atom.position);
    group.add(mesh);
  });
}

function cubicPoint(point: Vec3Tuple, repeat: number) {
  return new THREE.Vector3((point[0] - repeat / 2) * cellScale, (point[1] - repeat / 2) * cellScale, (point[2] - repeat / 2) * cellScale);
}

function addAtoms(group: THREE.Group, atoms: RenderAtom[], radius: number, opacity: number, moduleId: ModuleId, pickables?: THREE.Object3D[], clippingPlanes: THREE.Plane[] = [], atomMeshes?: Map<string, THREE.Mesh>) {
  const sphere = new THREE.SphereGeometry(radius, 32, 32);
  atoms.forEach((atom) => {
    let color = atom.kind === 'face' ? faceColor : atomColor;
    if (moduleId === 'coordination') color = coordinationBaseColor;
    if (atom.highlight) color = highlightColor;
    const material = createAtomMaterial(color, {
      emissive: atom.highlight ? '#665900' : atomVisualStyle.bodyLiftColor,
      emissiveIntensity: atom.highlight ? 0.9 : atomVisualStyle.bodyLiftIntensity,
      opacity,
      clippingPlanes,
      side: clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide,
      fog: moduleId !== 'coordination',
    });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.position.copy(atom.position);
    mesh.castShadow = false;
    if (moduleId === 'coordination' && pickables) {
      mesh.userData.kind = 'coordination-atom';
      mesh.userData.coordPosition = atom.position.toArray();
      pickables.push(mesh);
    }
    atomMeshes?.set(positionKey(atom.position), mesh);
    group.add(mesh);

    if (atom.highlight) {
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.18, 32, 16), new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.18, clippingPlanes, fog: false }));
      halo.position.copy(atom.position);
      group.add(halo);
    }
  });
}

export function applyCoordinationAtomVisuals(
  atomMeshes: Map<string, THREE.Mesh>,
  shell: ReturnType<typeof coordinationShell>,
) {
  atomMeshes.forEach((mesh) => {
    const material = mesh.material as THREE.MeshPhongMaterial;
    material.color.copy(coordinationBaseColor);
    material.emissive.set(atomVisualStyle.bodyLiftColor);
    material.emissiveIntensity = atomVisualStyle.bodyLiftIntensity;
  });
  if (!shell) return;

  shell.nearest.forEach(({ atom }) => {
    const mesh = atomMeshes.get(positionKey(atom.position));
    if (!mesh) return;
    const material = mesh.material as THREE.MeshPhongMaterial;
    material.color.copy(coordinationNeighborColor);
    material.emissive.set('#5c080b');
    material.emissiveIntensity = 0.45;
  });

  const centerMesh = atomMeshes.get(positionKey(shell.center));
  if (centerMesh) {
    const material = centerMesh.material as THREE.MeshPhongMaterial;
    material.color.copy(highlightColor);
    material.emissive.set('#665900');
    material.emissiveIntensity = 0.9;
  }
}

export function nearestNeighborBondPairs(atoms: RenderAtom[], crystal: CrystalType) {
  const geometry = latticeGeometry[crystal];
  const expected = 2 * geometry.atomRadiusOverA * geometry.worldA;
  const tolerance = expected * 0.025;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const distance = atoms[i].position.distanceTo(atoms[j].position);
      if (Math.abs(distance - expected) <= tolerance) pairs.push([i, j]);
    }
  }
  return pairs;
}

function addBonds(group: THREE.Group, atoms: RenderAtom[], crystal: CrystalType, clippingPlanes: THREE.Plane[] = []) {
  const material = new THREE.MeshPhysicalMaterial({ color: '#c8d8ee', transparent: true, opacity: 0.55, roughness: 0.5, metalness: 0.1, clippingPlanes });
  nearestNeighborBondPairs(atoms, crystal).forEach(([i, j]) => {
        const distance = atoms[i].position.distanceTo(atoms[j].position);
        const dir = atoms[j].position.clone().sub(atoms[i].position);
        const mid = atoms[i].position.clone().add(atoms[j].position).multiplyScalar(0.5);
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(atomVisualStyle.bondRadius, atomVisualStyle.bondRadius, distance, 8, 1), material);
        cylinder.position.copy(mid);
        cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        group.add(cylinder);
  });
}

function addBravaisSites(group: THREE.Group, sites: RenderAtom[], clippingPlanes: THREE.Plane[]) {
  const geometry = new THREE.BufferGeometry().setFromPoints(sites.map(({ position }) => position));
  const material = new THREE.PointsMaterial({
    color: bravaisPointStyle.color,
    size: bravaisPointStyle.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.98,
    map: createRoundPointTexture(),
    alphaTest: 0.2,
    depthWrite: false,
    clippingPlanes,
  });
  group.add(new THREE.Points(geometry, material));
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
  const material = new THREE.LineBasicMaterial({ color: vivid ? '#7dd0ff' : '#eef5ff', transparent: true, opacity: vivid ? 0.55 : 0.72, fog: false });
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const center = new THREE.Vector3(
          (ix - (repeat - 1) / 2) * cellScale,
          (iy - (repeat - 1) / 2) * cellScale,
          (iz - (repeat - 1) / 2) * cellScale,
        );
        addCubicFrameAtCenter(group, center, material);
      }
    }
  }
}

function setCellFrameGroupProgress(group: THREE.Group | null, progress: number) {
  if (!group) return;
  const clamped = Math.max(0, Math.min(1, progress));
  const materials = new Set<THREE.LineBasicMaterial>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Line)) return;
    const material = object.material as THREE.LineBasicMaterial;
    materials.add(material);
  });
  materials.forEach((material) => {
    if (material.userData.fullOpacity === undefined) material.userData.fullOpacity = material.opacity;
    material.opacity = Number(material.userData.fullOpacity) * clamped;
    material.needsUpdate = true;
  });
}

function addCubicFrameAtCenter(group: THREE.Group, center: THREE.Vector3, material: THREE.LineBasicMaterial) {
  const points = cornerPositions.map(([x, y, z]) => new THREE.Vector3(
    (x - 0.5) * cellScale + center.x,
    (y - 0.5) * cellScale + center.y,
    (z - 0.5) * cellScale + center.z,
  ));
  cubicEdges.forEach(([a, b]) => {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([points[a], points[b]]), material));
  });
}

function addHcpFrame(group: THREE.Group, offset: THREE.Vector3, vivid: boolean) {
  const bottom = hcpBottom.map((p) => p.clone().add(offset));
  const top = hcpTop.map((p) => p.clone().add(offset));
  const material = new THREE.LineBasicMaterial({ color: vivid ? '#7dd0ff' : '#eef5ff', transparent: true, opacity: vivid ? 0.54 : 0.72, fog: false });
  for (let i = 0; i < 6; i++) {
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([bottom[i], bottom[(i + 1) % 6]]), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([top[i], top[(i + 1) % 6]]), material));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([bottom[i], top[i]]), material));
  }
}

function addPacking(group: THREE.Group, crystal: CrystalType) {
  const planeColor = packingPlaneColor;
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

  let start: THREE.Vector3;
  let end: THREE.Vector3;
  if (crystal === 'FCC') {
    const [startFractional, endFractional] = fcc110DirectionEndpoints();
    start = cubicPoint(startFractional, 1);
    end = cubicPoint(endFractional, 1);
  } else if (crystal === 'BCC') {
    const [startFractional, endFractional] = bcc111DirectionEndpoints();
    start = cubicPoint(startFractional, 1);
    end = cubicPoint(endFractional, 1);
  } else {
    start = vertices[3].clone();
    end = vertices[0].clone();
  }
  addPackingDirectionVector(group, start, end, dirColor);

  if (crystal !== 'FCC') {
    const label = createTextSprite(`${crystals[crystal].densePlane} / ${crystals[crystal].denseDirection}`, '#ffffff', 32);
    label.position.set(0, 1.75, 1.65);
    label.scale.set(1.35, 0.38, 1);
    group.add(label);
  }
}

function addPackingDirectionVector(group: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, color: THREE.ColorRepresentation) {
  const direction = end.clone().sub(start);
  const shaft = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 12, packingDirectionStyle.shaftRadius, 10, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false, fog: false }),
  );
  shaft.renderOrder = 20;
  group.add(shaft);

  const arrow = new THREE.ArrowHelper(
    direction.clone().normalize(),
    start,
    direction.length(),
    color,
    packingDirectionStyle.headLength,
    packingDirectionStyle.headWidth,
  );
  arrow.traverse((object) => {
    const objectMaterial = (object as THREE.Mesh).material as THREE.Material | undefined;
    if (objectMaterial) {
      objectMaterial.depthTest = false;
      objectMaterial.transparent = true;
      if ('fog' in objectMaterial) objectMaterial.fog = false;
    }
    object.renderOrder = 20;
  });
  group.add(arrow);
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

function addCoordination(group: THREE.Group, shell: NonNullable<ReturnType<typeof coordinationShell>>, atomRadius: number, renderedAtomKeys: Set<string>, coordAnimRef: React.MutableRefObject<{ objects: THREE.Object3D[]; startTime: number }>, centerPulseRef: React.MutableRefObject<THREE.Mesh | null>) {
  coordAnimRef.current = { objects: [], startTime: performance.now() };
  centerPulseRef.current = null;
  const { center, nearest } = shell;

  const pulseHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 16),
    new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.18, fog: false }),
  );
  pulseHalo.position.copy(center);
  group.add(pulseHalo);
  centerPulseRef.current = pulseHalo;

  [0.44, 0.68, 0.92].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.01, 8, 96),
      new THREE.MeshBasicMaterial({ color: '#fff65c', transparent: true, opacity: 0.2 - index * 0.04, fog: false }),
    );
    ring.position.copy(center);
    group.add(ring);
  });

  const animObjects: THREE.Object3D[] = [];
  nearest.forEach((item) => {
    const neighborGroup = new THREE.Group();
    neighborGroup.scale.setScalar(0);

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([center, item.atom.position]),
      new THREE.LineBasicMaterial({ color: coordinationNeighborColor, transparent: true, opacity: 0.82, fog: false }),
    );
    neighborGroup.add(line);
    if (!renderedAtomKeys.has(positionKey(item.atom.position))) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(atomRadius, 32, 24),
        createAtomMaterial(coordinationNeighborColor, { emissive: '#5c080b', emissiveIntensity: 0.45, fog: false }),
      );
      sphere.position.copy(item.atom.position);
      neighborGroup.add(sphere);
    }
    group.add(neighborGroup);
    animObjects.push(neighborGroup);
  });
  coordAnimRef.current = { objects: animObjects, startTime: performance.now() };
}

function updateCoordinationSelection(
  context: CoordinationSelectionContext,
  target: Vec3Tuple | null,
  coordAnimRef: React.MutableRefObject<{ objects: THREE.Object3D[]; startTime: number }>,
  centerPulseRef: React.MutableRefObject<THREE.Mesh | null>,
) {
  clearGroup(context.layer);
  clearGroup(context.frameGroup);
  coordAnimRef.current = { objects: [], startTime: 0 };
  centerPulseRef.current = null;

  const frameRepeat = cellFrameRepeat(context.crystal, 'coordination', Boolean(target), context.showSupercell);
  addCellFrames(context.frameGroup, context.crystal, frameRepeat, false);
  setCellFrameGroupProgress(context.frameGroup, target && !context.showSupercell ? 0 : 1);

  const shell = target
    ? coordinationShell(context.atoms, context.crystal, new THREE.Vector3(...target))
    : null;
  applyCoordinationAtomVisuals(context.atomMeshes, shell);
  if (shell) {
    addCoordination(
      context.layer,
      shell,
      context.radius,
      context.renderedAtomKeys,
      coordAnimRef,
      centerPulseRef,
    );
  }
  return shell;
}

export function gapVisualStyle(kind: 'tetra' | 'octa') {
  return {
    radius: 0.15,
    color: kind === 'tetra' ? '#45d27a' : '#f39a42',
  } as const;
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
  const cage = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false, fog: false }),
  );
  cage.renderOrder = 18;
  group.add(cage);
}

export function addGapTargets(group: THREE.Group, crystal: CrystalType, kind: 'tetra' | 'octa', repeat: number, pickables: THREE.Object3D[]) {
  const positions = getGapPositions(crystal, kind, repeat);
  const { radius, color } = gapVisualStyle(kind);
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  const meshes: THREE.Mesh[] = [];
  positions.forEach((position, index) => {
    const sphere = new THREE.Mesh(
      geometry,
      createAtomMaterial(color, { emissive: kind === 'tetra' ? '#0b5429' : '#6b3107', emissiveIntensity: 0.6 }),
    );
    sphere.position.copy(position);
    sphere.userData.kind = 'gap-target';
    sphere.userData.gapIndex = index;
    group.add(sphere);
    pickables.push(sphere);
    meshes.push(sphere);
  });
  return { positions, meshes };
}

export function renderGapSelectionLayer(
  layer: THREE.Group,
  crystal: CrystalType,
  kind: 'tetra' | 'octa',
  positions: THREE.Vector3[],
  renderedAtoms: RenderAtom[],
  selectedIndex = 0,
  repeat = 1,
  atomRadius = atomRenderRadius(crystal, 'schematic'),
  renderedAtomKeys = new Set(renderedAtoms.map((atom) => positionKey(atom.position))),
) {
  clearGroup(layer);
  if (positions.length === 0) return 0;
  const normalizedIndex = Math.min(Math.max(selectedIndex, 0), positions.length - 1);
  const position = positions[normalizedIndex];
  const { color } = gapVisualStyle(kind);
  const surrounding = findSurroundingAtoms(crystal, position, kind, renderedAtoms, repeat);
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92, depthTest: false, fog: false });
  surrounding.forEach((atomPos) => {
    const connector = new THREE.Line(new THREE.BufferGeometry().setFromPoints([position, atomPos]), lineMat);
    connector.renderOrder = 18;
    layer.add(connector);
  });
  if (surrounding.length >= 3) addPolyhedronCage(layer, surrounding, position, kind, color, 0.45);
  addMissingGapNeighborAtoms(layer, surrounding, renderedAtomKeys, atomRadius);
  return surrounding.length;
}

export function missingPeriodicGapNeighbors(surrounding: THREE.Vector3[], renderedAtomKeys: Set<string>) {
  return surrounding.filter((position) => !renderedAtomKeys.has(positionKey(position)));
}

function addMissingGapNeighborAtoms(
  layer: THREE.Group,
  surrounding: THREE.Vector3[],
  renderedAtomKeys: Set<string>,
  atomRadius: number,
) {
  const missing = missingPeriodicGapNeighbors(surrounding, renderedAtomKeys);
  if (missing.length === 0) return;
  const geometry = new THREE.SphereGeometry(atomRadius, 32, 24);
  missing.forEach((position) => {
    const mesh = new THREE.Mesh(
      geometry,
      createAtomMaterial(atomVisualStyle.baseColor, {
        emissive: atomVisualStyle.bodyLiftColor,
        emissiveIntensity: atomVisualStyle.bodyLiftIntensity,
        opacity: atomOpacityForModule('tetra'),
        fog: false,
      }),
    );
    mesh.position.copy(position);
    mesh.userData.kind = 'periodic-gap-neighbor';
    layer.add(mesh);
  });
}

export function findSurroundingAtoms(
  crystal: CrystalType,
  gapPos: THREE.Vector3,
  kind: 'tetra' | 'octa',
  renderedAtoms = createAtoms(crystal, 1, false, kind),
  repeat = 1,
): THREE.Vector3[] {
  const count = kind === 'tetra' ? 4 : 6;
  const translations: THREE.Vector3[] = [];
  for (let ix = -1; ix <= 1; ix++) {
    for (let iy = -1; iy <= 1; iy++) {
      for (let iz = -1; iz <= 1; iz++) {
        translations.push(crystal === 'HCP'
          ? new THREE.Vector3(...hcpTranslation(ix * repeat, iy * repeat, iz * repeat))
          : new THREE.Vector3(ix * repeat * cellScale, iy * repeat * cellScale, iz * repeat * cellScale));
      }
    }
  }
  const candidates = uniqueVectors(renderedAtoms.flatMap((atom) => (
    translations.map((translation) => atom.position.clone().add(translation))
  )));
  return candidates
    .map((position) => ({ position, distance: position.distanceTo(gapPos) }))
    .filter(({ distance }) => distance > 0.01)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ position }) => position);
}

function addSectionPlane(group: THREE.Group, crystal: CrystalType) {
  const geometry = crystal === 'HCP'
    ? new THREE.PlaneGeometry(hcpGeometry.c * 1.2, hcpGeometry.a * 2.15)
    : new THREE.PlaneGeometry(cellScale * 1.15, cellScale * 1.15);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#8ceaff', transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  mesh.rotation.y = Math.PI / 2;
  group.add(mesh);
}

function addAxes(group: THREE.Group, crystal: CrystalType) {
  const origin = crystal === 'HCP'
    ? new THREE.Vector3(-2.0, -2.1, -1.7)
    : new THREE.Vector3(-2.45, -2.1, -1.7);
  const arrowLength = crystal === 'HCP' ? 0.76 : 0.62;
  const labelDistance = crystal === 'HCP' ? 0.94 : 0.78;
  const labelScale = crystal === 'HCP' ? 0.3 : 0.24;
  crystalAxisVectors(crystal).forEach(({ label, direction, color }) => {
    const vector = new THREE.Vector3(...direction).normalize();
    group.add(new THREE.ArrowHelper(vector, origin, arrowLength, color, 0.15, 0.09));
    const text = createTextSprite(label, `#${color.toString(16).padStart(6, '0')}`, 28);
    text.position.copy(origin.clone().add(vector.multiplyScalar(labelDistance)));
    text.scale.setScalar(labelScale);
    group.add(text);
  });
}

export function getGapPositions(crystal: CrystalType, kind: 'tetra' | 'octa', repeat = 1) {
  if (crystal === 'HCP') {
    const positions: THREE.Vector3[] = [];
    for (let ix = 0; ix < repeat; ix++) {
      for (let iy = 0; iy < repeat; iy++) {
        for (let iz = 0; iz < repeat; iz++) {
          const offset = new THREE.Vector3(...hcpCellOffset(ix, iy, iz, repeat));
          hcpGapPositions(kind).forEach((position) => positions.push(new THREE.Vector3(...position).add(offset)));
        }
      }
    }
    return uniqueVectors(positions).sort((a, b) => a.lengthSq() - b.lengthSq());
  }
  let fractions: Vec3Tuple[];
  if (crystal === 'FCC') {
    if (kind === 'tetra') {
      fractions = [[0.25,0.25,0.25],[0.75,0.25,0.25],[0.25,0.75,0.25],[0.25,0.25,0.75],
        [0.75,0.75,0.25],[0.75,0.25,0.75],[0.25,0.75,0.75],[0.75,0.75,0.75]];
    } else {
      fractions = [
        [0.5,0.5,0.5],
        [0.5,0,0],[0.5,1,0],[0.5,0,1],[0.5,1,1],
        [0,0.5,0],[1,0.5,0],[0,0.5,1],[1,0.5,1],
        [0,0,0.5],[1,0,0.5],[0,1,0.5],[1,1,0.5],
      ];
    }
  } else if (kind === 'tetra') {
    fractions = [
      [0.5,0.25,0],[0.5,0.75,0],[0.25,0.5,0],[0.75,0.5,0],
      [0.5,0.25,1],[0.5,0.75,1],[0.25,0.5,1],[0.75,0.5,1],
      [0,0.5,0.25],[0,0.5,0.75],[0,0.25,0.5],[0,0.75,0.5],
      [1,0.5,0.25],[1,0.5,0.75],[1,0.25,0.5],[1,0.75,0.5],
      [0.5,0,0.25],[0.5,0,0.75],[0.25,0,0.5],[0.75,0,0.5],
      [0.5,1,0.25],[0.5,1,0.75],[0.25,1,0.5],[0.75,1,0.5],
    ];
  } else {
    fractions = [
      [0.5,0.5,0],[0.5,0.5,1],[0.5,0,0.5],[0.5,1,0.5],[0,0.5,0.5],[1,0.5,0.5],
      [0.5,0,0],[0.5,1,0],[0.5,0,1],[0.5,1,1],
      [0,0.5,0],[1,0.5,0],[0,0.5,1],[1,0.5,1],
      [0,0,0.5],[1,0,0.5],[0,1,0.5],[1,1,0.5],
    ];
  }

  const positions: THREE.Vector3[] = [];
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        fractions.forEach(([x, y, z]) => positions.push(cubicPoint([x + ix, y + iy, z + iz], repeat)));
      }
    }
  }
  return uniqueVectors(positions).sort((a, b) => a.lengthSq() - b.lengthSq());
}

export function getGapLabel(crystal: CrystalType, kind: 'tetra' | 'octa', index: number) {
  if (crystal === 'HCP') {
    if (kind === 'tetra') {
      const dir = index % 2 === 0 ? '下指' : '上指';
      return `层间${dir} [12/cell]`;
    }
    return '层间八面体 [6/cell]';
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

function createRoundPointTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(16, 16, 13, 0, Math.PI * 2);
  context.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function cameraPreset(crystal: CrystalType, repeat: number, activeModule: ModuleId) {
  const baseDistance = crystal === 'HCP'
    ? (repeat > 1 ? 13.2 : 8.5)
    : (repeat > 1 ? 13.4 : 8.1);
  const distance = crystal === 'FCC' && activeModule === 'packing' ? 10.5 : baseDistance;
  const target = crystal === 'FCC' && activeModule === 'packing'
    ? new THREE.Vector3(0.55, 0.08, -0.42)
    : new THREE.Vector3(0, 0, 0);
  const offset = new THREE.Vector3(distance * 0.62, -distance * 0.56, distance * 0.52);
  return {
    up: [0, 0, 1] as Vec3Tuple,
    position: target.clone().add(offset).toArray() as Vec3Tuple,
    target: target.toArray() as Vec3Tuple,
  };
}

function setDefaultCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, crystal: CrystalType, repeat: number, activeModule: ModuleId) {
  const preset = cameraPreset(crystal, repeat, activeModule);
  camera.up.set(...preset.up);
  camera.position.set(...preset.position);
  const target = new THREE.Vector3(...preset.target);
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
