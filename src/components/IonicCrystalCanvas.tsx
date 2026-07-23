import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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

interface VisualSite {
  siteIndex: number;
  speciesId: string;
  fractional: IonicVec3;
  position: THREE.Vector3;
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
}

const boundaryOptions = (value: number) => Math.abs(value) < 1e-7 ? [0, 1] : [value];
const vectorKey = (value: IonicVec3) => value.map((coordinate) => coordinate.toFixed(6)).join('|');
const siteKey = (siteIndex: number, fractional: IonicVec3) => `${siteIndex}|${vectorKey(fractional)}`;
export const IONIC_CAMERA_DIRECTION: IonicVec3 = [0.82, -0.4, 0.42];
export const WURTZITE_CAMERA_DIRECTION: IonicVec3 = [0.74, 0.43, 0.52];
export const ION_SITE_MUTED_OPACITY = 0.14;
const IONIC_BODY_LIFT_INTENSITY = 0.14;

export function centeredIonicPosition(crystal: IonicCrystalInfo, fractional: IonicVec3, repeat: number) {
  const cartesian = fractionalToCartesian(crystal.lattice, fractional);
  const center = fractionalToCartesian(crystal.lattice, [repeat / 2, repeat / 2, repeat / 2]);
  return new THREE.Vector3(cartesian[0] - center[0], cartesian[1] - center[1], cartesian[2] - center[2]);
}

export function createIonicVisualSites(crystal: IonicCrystalInfo, repeat: number): VisualSite[] {
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
  const [renderError, setRenderError] = useState<Error | null>(null);
  const crystal = resolveIonicCrystal(crystalId);
  const repeat = settings.showSupercell ? 2 : 1;
  const structureKey = `${crystalId}|${activeModule}|${repeat}`;

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { moduleRef.current = activeModule; }, [activeModule]);
  useEffect(() => {
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
      else setSelectedSpecies((current) => current === speciesId ? null : speciesId);
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
          createIonMaterial(ion.color),
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
    selectionContextRef.current = { crystal, module: activeModule, repeat, entries, layer };
    addIonicAxes(root, crystal, repeat);
    setIonicCamera(camera, controls, crystal, repeat);
    root.rotation.set(0, 0, 0);
    updateSelection(selectionContextRef.current, coordinationCenter, selectedSpecies);
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
            onClick={() => activeModule === 'ion-sites' && setSelectedSpecies((current) => current === item.id ? null : item.id)}
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
  context.entries.forEach((entry) => {
    const ion = speciesById.get(entry.speciesId)!;
    entry.mesh.material.color.set(ion.color);
    entry.mesh.material.emissive.set(ion.color);
    entry.mesh.material.emissiveIntensity = IONIC_BODY_LIFT_INTENSITY;
    entry.mesh.material.opacity = 1;
    entry.mesh.material.transparent = false;
    entry.mesh.material.depthWrite = true;
    entry.mesh.scale.setScalar(1);
  });
  clearGroup(context.layer);

  if (context.module === 'ion-sites' && selectedSpecies) {
    context.entries.forEach((entry) => {
      const selected = entry.speciesId === selectedSpecies;
      entry.mesh.material.transparent = !selected;
      entry.mesh.material.opacity = selected ? 1 : ION_SITE_MUTED_OPACITY;
      entry.mesh.material.depthWrite = selected;
      entry.mesh.material.emissive.set(selected ? speciesById.get(entry.speciesId)!.color : '#000000');
      entry.mesh.material.emissiveIntensity = selected ? 0.22 : 0;
      entry.mesh.scale.setScalar(selected ? 1.08 : 0.96);
    });
    return;
  }

  if (context.module !== 'coordination' || !coordinationCenter) return;
  const neighbors = ionicCoordinationShell(context.crystal, coordinationCenter);
  const centerKey = siteKey(coordinationCenter.siteIndex, coordinationCenter.fractional);
  const neighborKeys = new Set(neighbors.map((neighbor) => siteKey(neighbor.siteIndex, neighbor.fractional)));
  const existingKeys = new Set(context.entries.map((entry) => siteKey(entry.siteIndex, entry.fractional)));
  context.entries.forEach((entry) => {
    const key = siteKey(entry.siteIndex, entry.fractional);
    const isCenter = key === centerKey;
    const isNeighbor = neighborKeys.has(key);
    entry.mesh.material.transparent = !isCenter && !isNeighbor;
    entry.mesh.material.opacity = isCenter || isNeighbor ? 1 : 0.22;
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

  const centerPosition = centeredIonicPosition(context.crystal, coordinationCenter.fractional, context.repeat);
  neighbors.forEach((neighbor) => {
    const neighborPosition = centeredIonicPosition(context.crystal, neighbor.fractional, context.repeat);
    addLine(context.layer, centerPosition, neighborPosition, '#ff6269');
    if (!existingKeys.has(siteKey(neighbor.siteIndex, neighbor.fractional))) {
      const ion = speciesById.get(neighbor.speciesId)!;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(ionicAtomRadius(context.crystal, ion.radius), 28, 20),
        createIonMaterial('#ff4f57', '#5d090d', 0.28),
      );
      sphere.position.copy(neighborPosition);
      context.layer.add(sphere);
    }
  });
}

function createIonMaterial(
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
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#d7e7f7', transparent: true, opacity: 0.7 })));
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
    ? Math.max(6.7, Math.max(...lengths) * repeat * 1.9)
    : Math.max(8.1, Math.max(...lengths) * repeat * 2.3);
  const direction = crystal.id === 'zns-hex' ? WURTZITE_CAMERA_DIRECTION : IONIC_CAMERA_DIRECTION;
  return {
    up: [0, 0, 1] as IonicVec3,
    position: direction.map((component) => component * distance) as IonicVec3,
    target: [0, 0, 0] as IonicVec3,
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
