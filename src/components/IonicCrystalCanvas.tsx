import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CrystalCanvasHandle } from './CrystalCanvas';
import { atomVisualStyle, AUTO_ROTATE_RADIANS_PER_FRAME } from './CrystalCanvas';
import type { DisplaySettings } from '../data/crystals';
import {
  fractionalToCartesian,
  ionicCoordinationShell,
  ionicSpeciesMap,
  resolveIonicCrystal,
  type IonicCoordinationCenter,
  type IonicCrystalId,
  type IonicCrystalInfo,
  type IonicModuleId,
  type IonicVec3,
} from '../data/ionicCrystals';

interface Props {
  crystalId: IonicCrystalId;
  activeModule: IonicModuleId;
  settings: DisplaySettings;
}

export interface VisualSite {
  siteIndex: number;
  speciesId: string;
  fractional: IonicVec3;
  position: THREE.Vector3;
  displayWeight?: number;
}

interface IonMeshEntry extends VisualSite {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
}

interface SelectionContext {
  crystal: IonicCrystalInfo;
  module: IonicModuleId;
  repeat: number;
  entries: IonMeshEntry[];
  layer: THREE.Group;
  positionForFractional: (fractional: IonicVec3) => THREE.Vector3;
}

const boundaryOptions = (value: number) => Math.abs(value) < 1e-7 ? [0, 1] : [value];
const vectorKey = (value: IonicVec3) => value.map((coordinate) => coordinate.toFixed(6)).join('|');
const siteKey = (siteIndex: number, fractional: IonicVec3) => `${siteIndex}|${vectorKey(fractional)}`;
export const IONIC_CAMERA_DIRECTION: IonicVec3 = [0.82, -0.4, 0.42];
export const WURTZITE_CAMERA_DIRECTION: IonicVec3 = [0.74, 0.43, 0.52];
export const ION_SITE_MUTED_OPACITY = 0.16;
export const ION_SITE_MUTED_COLOR_FACTOR = 0.35;
const IONIC_BODY_LIFT_INTENSITY = 0.14;
const WURTZITE_PRISM_ORIGIN: IonicVec3 = [2 / 3, 1 / 3, 3 / 8];

export function ionicIonSiteVisualState(selected: boolean) {
  return {
    transparent: !selected,
    opacity: selected ? 1 : ION_SITE_MUTED_OPACITY,
    depthWrite: true,
    depthTest: true,
    emissiveIntensity: selected ? 0.22 : 0,
    colorFactor: selected ? 1 : ION_SITE_MUTED_COLOR_FACTOR,
    renderOrder: selected ? 2 : 1,
    scale: 1,
  };
}

export function nextIonicSpeciesSelection(_current: string | null, speciesId: string) {
  return speciesId;
}

export function applyIonicIonSiteVisual(
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>,
  ionColor: THREE.ColorRepresentation,
  selected: boolean,
) {
  const state = ionicIonSiteVisualState(selected);
  const material = mesh.material;
  const transparentChanged = material.transparent !== state.transparent;

  material.color.set(ionColor).multiplyScalar(state.colorFactor);
  material.emissive.set(selected ? ionColor : '#000000');
  material.emissiveIntensity = state.emissiveIntensity;
  material.transparent = state.transparent;
  material.opacity = state.opacity;
  material.depthWrite = state.depthWrite;
  material.depthTest = state.depthTest;
  mesh.renderOrder = state.renderOrder;
  mesh.scale.setScalar(state.scale);

  if (transparentChanged) material.needsUpdate = true;
}

export function applyDefaultIonicIonVisual(
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>,
  ionColor: THREE.ColorRepresentation,
) {
  const material = mesh.material;
  const transparentChanged = material.transparent;

  material.color.set(ionColor);
  material.emissive.set(ionColor);
  material.emissiveIntensity = IONIC_BODY_LIFT_INTENSITY;
  material.opacity = 1;
  material.transparent = false;
  material.depthWrite = true;
  material.depthTest = true;
  mesh.renderOrder = 0;
  mesh.scale.setScalar(1);

  if (transparentChanged) material.needsUpdate = true;
}

export function centeredIonicPosition(crystal: IonicCrystalInfo, fractional: IonicVec3, repeat: number) {
  const cartesian = fractionalToCartesian(crystal.lattice, fractional);
  const center = fractionalToCartesian(crystal.lattice, [repeat / 2, repeat / 2, repeat / 2]);
  return new THREE.Vector3(cartesian[0] - center[0], cartesian[1] - center[1], cartesian[2] - center[2]);
}

function wurtzitePrismCenterTranslation(repeat: number): IonicVec3 {
  return [1.5 * (repeat - 1), 1.5 * (repeat - 1), (repeat - 1) / 2];
}

export function wurtzitePrismPosition(
  crystal: IonicCrystalInfo,
  fractional: IonicVec3,
  repeat: number,
) {
  const center = wurtzitePrismCenterTranslation(repeat);
  const relative: IonicVec3 = [
    fractional[0] - WURTZITE_PRISM_ORIGIN[0] - center[0],
    fractional[1] - WURTZITE_PRISM_ORIGIN[1] - center[1],
    fractional[2] - WURTZITE_PRISM_ORIGIN[2] - center[2],
  ];
  const cartesian = fractionalToCartesian(crystal.lattice, relative);
  return new THREE.Vector3(...cartesian);
}

function isInsideWurtzitePrism(position: THREE.Vector3, radius: number) {
  const height = Math.sqrt(3) * radius / 2;
  const tolerance = 1e-6;
  return Math.abs(position.y) <= height + tolerance
    && Math.abs(position.x) + Math.abs(position.y) / Math.sqrt(3) <= radius + tolerance;
}

function wurtzitePrismTranslation(ix: number, iy: number, iz: number): IonicVec3 {
  return [2 * ix + iy, ix + 2 * iy, iz];
}

export function createWurtziteHexPrismVisualSites(
  crystal: IonicCrystalInfo,
  repeat: number,
): VisualSite[] {
  const radius = Math.hypot(...crystal.lattice[0]);
  const layerSpecs = [
    { siteIndex: 3, zOffsets: [-1, 0], centerWeight: 1 / 2, boundaryWeight: 1 / 6 },
    { siteIndex: 2, zOffsets: [0], centerWeight: 1, boundaryWeight: 1 },
    { siteIndex: 0, zOffsets: [0], centerWeight: 1, boundaryWeight: 1 },
    { siteIndex: 1, zOffsets: [0], centerWeight: 1, boundaryWeight: 1 / 3 },
  ];
  const baseSites: VisualSite[] = [];

  layerSpecs.forEach(({ siteIndex, zOffsets, centerWeight, boundaryWeight }) => {
    const site = crystal.sites[siteIndex];
    zOffsets.forEach((zOffset) => {
      for (let ix = -2; ix <= 2; ix++) {
        for (let iy = -2; iy <= 2; iy++) {
          const fractional: IonicVec3 = [
            site.fractional[0] + ix,
            site.fractional[1] + iy,
            site.fractional[2] + zOffset,
          ];
          const position = wurtzitePrismPosition(crystal, fractional, 1);
          if (!isInsideWurtzitePrism(position, radius)) continue;
          const isCenter = Math.hypot(position.x, position.y) < 1e-6;
          baseSites.push({
            siteIndex,
            speciesId: site.speciesId,
            fractional,
            position,
            displayWeight: isCenter ? centerWeight : boundaryWeight,
          });
        }
      }
    });
  });

  const sites = new Map<string, VisualSite>();
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const translation = wurtzitePrismTranslation(ix, iy, iz);
        baseSites.forEach((site) => {
          const fractional: IonicVec3 = [
            site.fractional[0] + translation[0],
            site.fractional[1] + translation[1],
            site.fractional[2] + translation[2],
          ];
          const position = wurtzitePrismPosition(crystal, fractional, repeat);
          const key = `${site.speciesId}|${position.toArray().map((value) => value.toFixed(6)).join('|')}`;
          const existing = sites.get(key);
          if (existing) {
            existing.displayWeight = (existing.displayWeight ?? 0) + (site.displayWeight ?? 1);
          } else {
            sites.set(key, { ...site, fractional, position });
          }
        });
      }
    }
  }
  return [...sites.values()];
}

export function createIonicVisualSites(crystal: IonicCrystalInfo, repeat: number): VisualSite[] {
  if (crystal.id === 'zns-hex') return createWurtziteHexPrismVisualSites(crystal, repeat);
  const sites = new Map<string, VisualSite>();
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        crystal.sites.forEach((site, siteIndex) => {
          const [xValues, yValues, zValues] = site.fractional.map(boundaryOptions) as [number[], number[], number[]];
          xValues.forEach((x) => yValues.forEach((y) => zValues.forEach((z) => {
            const fractional: IonicVec3 = [x + ix, y + iy, z + iz];
            const key = `${site.speciesId}|${vectorKey(fractional)}`;
            sites.set(key, {
              siteIndex,
              speciesId: site.speciesId,
              fractional,
              position: centeredIonicPosition(crystal, fractional, repeat),
            });
          })));
        });
      }
    }
  }
  return [...sites.values()];
}

export function createIonicBravaisPoints(crystal: IonicCrystalInfo, repeat: number) {
  if (crystal.id === 'zns-hex') return createWurtziteHexPrismBravaisPoints(crystal, repeat);
  const points = new Map<string, THREE.Vector3>();
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        crystal.latticePoints.forEach(([px, py, pz]) => {
          const [xValues, yValues, zValues] = [px, py, pz].map(boundaryOptions) as [number[], number[], number[]];
          xValues.forEach((x) => yValues.forEach((y) => zValues.forEach((z) => {
            const fractional: IonicVec3 = [x + ix, y + iy, z + iz];
            const key = vectorKey(fractional);
            points.set(key, centeredIonicPosition(crystal, fractional, repeat));
          })));
        });
      }
    }
  }
  return [...points.values()];
}

export function createWurtziteHexPrismBravaisPoints(crystal: IonicCrystalInfo, repeat: number) {
  const radius = Math.hypot(...crystal.lattice[0]);
  const height = Math.hypot(...crystal.lattice[2]) / 2;
  const basePoints = [-height, height].flatMap((z) => [
    new THREE.Vector3(0, 0, z),
    ...Array.from({ length: 6 }, (_, index) => {
      const angle = index * Math.PI / 3;
      return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
    }),
  ]);
  const points = new Map<string, THREE.Vector3>();
  const center = fractionalToCartesian(crystal.lattice, wurtzitePrismCenterTranslation(repeat));
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const offset = fractionalToCartesian(crystal.lattice, wurtzitePrismTranslation(ix, iy, iz));
        basePoints.forEach((point) => {
          const translated = point.clone().add(new THREE.Vector3(
            offset[0] - center[0],
            offset[1] - center[1],
            offset[2] - center[2],
          ));
          const key = translated.toArray().map((value) => value.toFixed(6)).join('|');
          points.set(key, translated);
        });
      }
    }
  }
  return [...points.values()];
}

export function ionicAtomRadius(crystal: IonicCrystalInfo, speciesRadius: number) {
  if (crystal.sites.length > 30) return speciesRadius * 0.68;
  if (crystal.sites.length > 16) return speciesRadius * 0.78;
  return speciesRadius;
}

export const IonicCrystalCanvas = forwardRef<CrystalCanvasHandle, Props>(function IonicCrystalCanvas(
  { crystalId, activeModule, settings },
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const settingsRef = useRef(settings);
  const moduleRef = useRef(activeModule);
  const selectionContextRef = useRef<SelectionContext | null>(null);
  const [coordinationCenter, setCoordinationCenter] = useState<IonicCoordinationCenter | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const coordinationCenterRef = useRef<IonicCoordinationCenter | null>(null);
  const selectedSpeciesRef = useRef<string | null>(null);
  const selectSpeciesRef = useRef<(speciesId: string) => void>(() => {});
  const [renderError, setRenderError] = useState<Error | null>(null);
  const crystal = resolveIonicCrystal(crystalId);
  const repeat = settings.showSupercell ? 2 : 1;
  const structureKey = `${crystalId}|${activeModule}|${repeat}`;

  settingsRef.current = settings;
  moduleRef.current = activeModule;
  coordinationCenterRef.current = coordinationCenter;
  selectedSpeciesRef.current = selectedSpecies;

  const selectSpecies = (speciesId: string) => {
    const nextSpecies = nextIonicSpeciesSelection(selectedSpeciesRef.current, speciesId);
    selectedSpeciesRef.current = nextSpecies;
    setSelectedSpecies(nextSpecies);
    const context = selectionContextRef.current;
    if (context?.module === 'ion-sites') {
      updateSelection(context, coordinationCenterRef.current, nextSpecies);
    }
  };
  selectSpeciesRef.current = selectSpecies;

  useLayoutEffect(() => {
    coordinationCenterRef.current = null;
    selectedSpeciesRef.current = null;
    setCoordinationCenter(null);
    setSelectedSpecies(null);
  }, [activeModule, crystalId]);

  useImperativeHandle(ref, () => ({
    resetView() {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      setIonicCamera(camera, controls, crystal, repeat);
      rootRef.current?.rotation.set(0, 0, 0);
    },
    capture() {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const link = document.createElement('a');
      link.download = `ionic-${crystalId}-${activeModule}.png`;
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    },
  }), [activeModule, crystal, crystalId, repeat]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05070c, 9, 20);
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x05070c, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    controls.maxDistance = 26;
    controlsRef.current = controls;

    const root = new THREE.Group();
    rootRef.current = root;
    scene.add(root);
    scene.add(new THREE.AmbientLight(0x708090, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, atomVisualStyle.keyLightIntensity);
    key.position.set(5, 10, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.75);
    rim.position.set(-5, -5, -5);
    scene.add(rim);

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
      if (!['coordination', 'ion-sites'].includes(moduleRef.current)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickablesRef.current, false)[0]?.object;
      if (!hit) return;
      const siteIndex = Number(hit.userData.siteIndex);
      const fractional = hit.userData.fractional as IonicVec3;
      const speciesId = String(hit.userData.speciesId);
      if (moduleRef.current === 'coordination') setCoordinationCenter({ siteIndex, fractional: [...fractional] });
      else selectSpeciesRef.current(speciesId);
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      controls.update();
      if (settingsRef.current.autoRotate && rootRef.current) rootRef.current.rotation.z += AUTO_ROTATE_RADIANS_PER_FRAME;
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
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      clearGroup(root);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!root || !camera || !controls) return;
    clearGroup(root);
    pickablesRef.current = [];

    addCellFrames(root, crystal, repeat);
    const layer = new THREE.Group();
    const entries: IonMeshEntry[] = [];
    if (activeModule === 'bravais') {
      addBravaisPoints(root, createIonicBravaisPoints(crystal, repeat));
    } else {
      const speciesById = ionicSpeciesMap(crystal);
      createIonicVisualSites(crystal, repeat).forEach((site) => {
        const ion = speciesById.get(site.speciesId);
        if (!ion) return;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(ionicAtomRadius(crystal, ion.radius), 28, 20),
          createIonicIonMaterial(ion.color),
        );
        mesh.position.copy(site.position);
        mesh.userData = {
          kind: 'ionic-site',
          siteIndex: site.siteIndex,
          speciesId: site.speciesId,
          fractional: [...site.fractional],
        };
        root.add(mesh);
        entries.push({ ...site, mesh });
        if (activeModule === 'coordination' || activeModule === 'ion-sites') pickablesRef.current.push(mesh);
      });
    }
    root.add(layer);
    const positionForFractional = crystal.id === 'zns-hex'
      ? (fractional: IonicVec3) => wurtzitePrismPosition(crystal, fractional, repeat)
      : (fractional: IonicVec3) => centeredIonicPosition(crystal, fractional, repeat);
    selectionContextRef.current = {
      crystal,
      module: activeModule,
      repeat,
      entries,
      layer,
      positionForFractional,
    };
    addIonicAxes(root, crystal, repeat);
    setIonicCamera(camera, controls, crystal, repeat);
    root.rotation.set(0, 0, 0);
    updateSelection(
      selectionContextRef.current,
      coordinationCenterRef.current,
      selectedSpeciesRef.current,
    );
  }, [structureKey]);

  useEffect(() => {
    const context = selectionContextRef.current;
    if (!context) return;
    updateSelection(context, coordinationCenter, selectedSpecies);
  }, [coordinationCenter, selectedSpecies]);

  const legend = useMemo(() => crystal.species.map((item) => ({ id: item.id, label: item.label, color: item.color })), [crystal]);

  if (renderError) throw renderError;

  return (
    <div className="viewport-wrap ionic-viewport">
      <div className="three-mount" ref={mountRef} />
      <div className="ionic-legend" aria-label="离子图例">
        {legend.map((item) => (
          <button
            type="button"
            key={item.id}
            className={selectedSpecies === item.id ? 'active' : ''}
            onClick={() => activeModule === 'ion-sites' && selectSpecies(item.id)}
            disabled={activeModule !== 'ion-sites'}
          >
            <span style={{ background: item.color }} />{item.label}
          </button>
        ))}
      </div>
      {activeModule === 'bravais' && (
        <BasisReadout crystal={crystal} />
      )}
      {activeModule === 'coordination' && !coordinationCenter && (
        <div className="stage-hint">点击任意离子查看最近邻配位</div>
      )}
      {crystal.id === 'zns-hex' && activeModule === 'cell' && (
        <div className="stage-hint">六棱柱由 3 个 P6₃mc 原胞拼合，边界节点按共享关系折算为 6 个 ZnS</div>
      )}
      {activeModule === 'ion-sites' && (
        <div className="stage-hint">点击离子或图例，突出显示同类离子位置</div>
      )}
    </div>
  );
});

function BasisReadout({ crystal }: { crystal: IonicCrystalInfo }) {
  const speciesById = ionicSpeciesMap(crystal);
  return (
    <div className="basis-readout">
      <span className="basis-readout-label">结构基元</span>
      <div className="basis-ion-combination" aria-label={`结构基元：${crystal.basis}`}>
        {crystal.basisIons.map((group, groupIndex) => {
          const ion = speciesById.get(group.speciesId);
          if (!ion) return null;
          return (
            <div className="basis-ion-part" key={group.speciesId}>
              {groupIndex > 0 && <span className="basis-plus">+</span>}
              <span className="basis-ion-balls" aria-hidden="true">
                {Array.from({ length: group.count }, (_, index) => (
                  <span
                    className="basis-ion-ball"
                    key={index}
                    style={{
                      background: `radial-gradient(circle at 32% 28%, #ffffff 0 8%, ${ion.color} 26%, ${ion.color} 62%, #07101b 145%)`,
                      boxShadow: `0 0 10px ${ion.color}66`,
                    }}
                  />
                ))}
              </span>
              <b>{ion.label}{group.count > 1 ? ` × ${group.count}` : ''}</b>
            </div>
          );
        })}
      </div>
      <strong>{crystal.basis}</strong>
    </div>
  );
}

function updateSelection(
  context: SelectionContext,
  coordinationCenter: IonicCoordinationCenter | null,
  selectedSpecies: string | null,
) {
  const speciesById = ionicSpeciesMap(context.crystal);
  clearGroup(context.layer);

  if (context.module === 'ion-sites' && selectedSpecies) {
    context.entries.forEach((entry) => {
      const selected = entry.speciesId === selectedSpecies;
      applyIonicIonSiteVisual(entry.mesh, speciesById.get(entry.speciesId)!.color, selected);
    });
    return;
  }

  context.entries.forEach((entry) => {
    applyDefaultIonicIonVisual(entry.mesh, speciesById.get(entry.speciesId)!.color);
  });

  if (context.module !== 'coordination' || !coordinationCenter) return;
  const neighbors = ionicCoordinationShell(context.crystal, coordinationCenter);
  const centerKey = siteKey(coordinationCenter.siteIndex, coordinationCenter.fractional);
  const neighborKeys = new Set(neighbors.map((neighbor) => siteKey(neighbor.siteIndex, neighbor.fractional)));
  const existingKeys = new Set(context.entries.map((entry) => siteKey(entry.siteIndex, entry.fractional)));
  context.entries.forEach((entry) => {
    const key = siteKey(entry.siteIndex, entry.fractional);
    const isCenter = key === centerKey;
    const isNeighbor = neighborKeys.has(key);
    const transparent = !isCenter && !isNeighbor;
    const transparentChanged = entry.mesh.material.transparent !== transparent;
    entry.mesh.material.transparent = transparent;
    entry.mesh.material.opacity = isCenter || isNeighbor ? 1 : 0.22;
    if (transparentChanged) entry.mesh.material.needsUpdate = true;
    if (isCenter) {
      entry.mesh.material.color.set('#fff35a');
      entry.mesh.material.emissive.set('#7c6f00');
      entry.mesh.material.emissiveIntensity = 0.42;
      entry.mesh.scale.setScalar(1.08);
    } else if (isNeighbor) {
      entry.mesh.material.color.set('#ff4f57');
      entry.mesh.material.emissive.set('#5d090d');
      entry.mesh.material.emissiveIntensity = 0.28;
    }
  });

  const centerPosition = context.positionForFractional(coordinationCenter.fractional);
  neighbors.forEach((neighbor) => {
    const neighborPosition = context.positionForFractional(neighbor.fractional);
    addLine(context.layer, centerPosition, neighborPosition, '#ff6269');
    if (!existingKeys.has(siteKey(neighbor.siteIndex, neighbor.fractional))) {
      const ion = speciesById.get(neighbor.speciesId)!;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(ionicAtomRadius(context.crystal, ion.radius), 28, 20),
        createIonicIonMaterial('#ff4f57', '#5d090d', 0.28),
      );
      sphere.position.copy(neighborPosition);
      context.layer.add(sphere);
    }
  });
}

export function createIonicIonMaterial(
  color: THREE.ColorRepresentation,
  emissive: THREE.ColorRepresentation = color,
  emissiveIntensity = IONIC_BODY_LIFT_INTENSITY,
) {
  return new THREE.MeshPhongMaterial({
    color,
    specular: atomVisualStyle.specularColor,
    shininess: atomVisualStyle.shininess,
    emissive,
    emissiveIntensity,
  });
}

function addCellFrames(group: THREE.Group, crystal: IonicCrystalInfo, repeat: number) {
  if (crystal.id === 'zns-hex') {
    const points = createWurtziteHexPrismFrameSegments(crystal, repeat)
      .flatMap(([start, end]) => [...start.toArray(), ...end.toArray()]);
    addCellFrameSegments(group, points);
    return;
  }
  const edges: [number, number][] = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const points: number[] = [];
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const corners: IonicVec3[] = [
          [ix, iy, iz], [ix + 1, iy, iz], [ix, iy + 1, iz], [ix + 1, iy + 1, iz],
          [ix, iy, iz + 1], [ix + 1, iy, iz + 1], [ix, iy + 1, iz + 1], [ix + 1, iy + 1, iz + 1],
        ];
        edges.forEach(([start, end]) => {
          points.push(...centeredIonicPosition(crystal, corners[start], repeat).toArray());
          points.push(...centeredIonicPosition(crystal, corners[end], repeat).toArray());
        });
      }
    }
  }
  addCellFrameSegments(group, points);
}

function addCellFrameSegments(group: THREE.Group, points: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#d7e7f7', transparent: true, opacity: 0.7 })));
}

export function createWurtziteHexPrismFrameSegments(
  crystal: IonicCrystalInfo,
  repeat: number,
): Array<[THREE.Vector3, THREE.Vector3]> {
  const radius = Math.hypot(...crystal.lattice[0]);
  const halfHeight = Math.hypot(...crystal.lattice[2]) / 2;
  const zLevels = [-halfHeight, 0, halfHeight];
  const verticesAt = (z: number) => Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
  });
  const baseSegments: Array<[THREE.Vector3, THREE.Vector3]> = [];

  zLevels.forEach((z) => {
    const vertices = verticesAt(z);
    vertices.forEach((vertex, index) => {
      baseSegments.push([vertex, vertices[(index + 1) % vertices.length]]);
      baseSegments.push([new THREE.Vector3(0, 0, z), vertex]);
    });
  });
  const bottom = verticesAt(-halfHeight);
  const top = verticesAt(halfHeight);
  bottom.forEach((vertex, index) => baseSegments.push([vertex, top[index]]));
  baseSegments.push([
    new THREE.Vector3(0, 0, -halfHeight),
    new THREE.Vector3(0, 0, halfHeight),
  ]);

  const segments = new Map<string, [THREE.Vector3, THREE.Vector3]>();
  const center = fractionalToCartesian(crystal.lattice, wurtzitePrismCenterTranslation(repeat));
  for (let ix = 0; ix < repeat; ix++) {
    for (let iy = 0; iy < repeat; iy++) {
      for (let iz = 0; iz < repeat; iz++) {
        const translated = fractionalToCartesian(
          crystal.lattice,
          wurtzitePrismTranslation(ix, iy, iz),
        );
        const offset = new THREE.Vector3(
          translated[0] - center[0],
          translated[1] - center[1],
          translated[2] - center[2],
        );
        baseSegments.forEach(([start, end]) => {
          const nextStart = start.clone().add(offset);
          const nextEnd = end.clone().add(offset);
          const startKey = nextStart.toArray().map((value) => value.toFixed(6)).join('|');
          const endKey = nextEnd.toArray().map((value) => value.toFixed(6)).join('|');
          const key = [startKey, endKey].sort().join('~');
          segments.set(key, [nextStart, nextEnd]);
        });
      }
    }
  }
  return [...segments.values()];
}

function addBravaisPoints(group: THREE.Group, points: THREE.Vector3[]) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.PointsMaterial({
    color: '#7dd0ff',
    size: 0.13,
    sizeAttenuation: true,
    map: createRoundPointTexture(),
    transparent: true,
    alphaTest: 0.2,
  });
  group.add(new THREE.Points(geometry, material));
}

function addIonicAxes(group: THREE.Group, crystal: IonicCrystalInfo, repeat: number) {
  const diagonal = centeredIonicPosition(crystal, [repeat, repeat, repeat], repeat)
    .sub(centeredIonicPosition(crystal, [0, 0, 0], repeat));
  const size = Math.max(2.65, diagonal.length() / Math.sqrt(3));
  const origin = new THREE.Vector3(-size * 0.72, -size * 0.62, -size * 0.56);
  const axes = crystal.id === 'zns-hex'
    ? [
      { label: 'a₁', direction: new THREE.Vector3(...crystal.lattice[0]).normalize(), color: 0xff554f },
      { label: 'a₂', direction: new THREE.Vector3(...crystal.lattice[1]).normalize(), color: 0x3bd56f },
      { label: 'c', direction: new THREE.Vector3(...crystal.lattice[2]).normalize(), color: 0x4385ff },
    ]
    : [
      { label: 'X', direction: new THREE.Vector3(1, 0, 0), color: 0xff554f },
      { label: 'Y', direction: new THREE.Vector3(0, 1, 0), color: 0x3bd56f },
      { label: 'Z', direction: new THREE.Vector3(0, 0, 1), color: 0x4385ff },
    ];
  axes.forEach(({ label, direction, color }) => {
    group.add(new THREE.ArrowHelper(direction, origin, 0.62, color, 0.15, 0.09));
    const sprite = createTextSprite(label, `#${color.toString(16).padStart(6, '0')}`);
    sprite.position.copy(origin).add(direction.clone().multiplyScalar(0.8));
    sprite.scale.setScalar(0.24);
    group.add(sprite);
  });
}

function setIonicCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  crystal: IonicCrystalInfo,
  repeat: number,
) {
  const preset = ionicCameraPreset(crystal, repeat);
  camera.up.set(...preset.up);
  camera.position.set(...preset.position);
  controls.target.set(...preset.target);
  controls.update();
}

export function ionicCameraPreset(crystal: IonicCrystalInfo, repeat: number) {
  const lengths = crystal.lattice.map((vector) => Math.hypot(...vector));
  const distance = crystal.id === 'zns-hex'
    ? Math.max(7.4, Math.max(...lengths) * repeat * 2.2)
    : Math.max(8.1, Math.max(...lengths) * repeat * 2.3);
  const direction = crystal.id === 'zns-hex' ? WURTZITE_CAMERA_DIRECTION : IONIC_CAMERA_DIRECTION;
  const target: IonicVec3 = crystal.id === 'zns-hex' ? [0, 0, -0.24] : [0, 0, 0];
  return {
    up: [0, 0, 1] as IonicVec3,
    position: direction.map((component, index) => component * distance + target[index]) as IonicVec3,
    target,
  };
}

function addLine(group: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, color: THREE.ColorRepresentation) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
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

function createTextSprite(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.font = '700 28px Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(0.45, 0.3, 1);
  return sprite;
}

function clearGroup(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children.pop()!;
    child.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const dispose = (item: THREE.Material) => {
        const map = (item as THREE.MeshBasicMaterial).map;
        map?.dispose();
        item.dispose();
      };
      if (Array.isArray(material)) material.forEach(dispose);
      else if (material) dispose(material);
    });
  }
}
