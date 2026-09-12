/**
 * useThreeScene — React hook managing the Three.js WebGL renderer lifecycle.
 *
 * Creates a scene, camera, lights, and orbit controls inside a provided
 * container ref. Returns helpers to add/clear meshes, switch render modes,
 * apply lighting presets, and simulate outfit toggles.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BuiltMesh } from './meshFactory';

export type RenderMode = 'pbr' | 'diffuse' | 'clay' | 'normal';
export type LightingPreset = 'studio' | 'anime' | 'dramatic';
export type CameraPreset = 'front' | 'back' | 'left' | 'right' | 'face' | 'reset';

export interface ThreeSceneAPI {
  /** Replace all meshes in the scene with new ones. */
  setMeshes: (meshes: BuiltMesh[]) => void;
  /** Clear all meshes from the scene. */
  clear: () => void;
  /** Trigger a manual render frame. */
  requestRender: () => void;
  /** Trigger a manual resize (e.g. when the container changes size). */
  resize: () => void;
  /** Reset the camera to fit all meshes. */
  fitCamera: () => void;
  /** Position the camera at a predefined viewpoint angle. */
  setCameraPreset: (preset: CameraPreset) => void;
  /** Toggle turntable continuous 360° idle rotation. */
  setTurntable: (enabled: boolean) => void;
  /** Rotate all meshes in the scene around the vertical Y axis. */
  rotateModelY: (angle?: number) => void;
  /** Set render mode: PBR, diffuse-only, clay, or normal map visualization. */
  setRenderMode: (mode: RenderMode) => void;
  /** Toggle wireframe overlay on all meshes. */
  setWireframe: (enabled: boolean) => void;
  /** Set studio/anime/dramatic lighting preset. */
  setLightingPreset: (preset: LightingPreset) => void;
  /** Toggle visibility of a specific mesh by index. */
  setMeshVisibility: (index: number, visible: boolean) => void;
  /** Update visibility of meshes based on active toggle variable values. */
  applyToggles: (toggleValues: Record<string, number>) => void;
  /** Capture a clean snapshot of the current 3D viewport (without grid) as a PNG data URL. */
  captureSnapshot: () => string | null;
}

/**
 * Safely evaluate an INI condition expression against active toggle values.
 * Supports:
 * - Disjunctions with `||` (OR)
 * - Conjunctions with `&&` (AND)
 * - Relational comparisons: ==, !=, >=, <=, >, <
 * - Negation: !$var, !var
 * - Variable normalization: with or without leading `$`
 */
export function evaluateCondition(
  expr: string | null | undefined,
  values: Record<string, number>
): boolean {
  if (!expr || !expr.trim()) return true;

  // Build normalized lowercase map from values
  const normalizedValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    const lowerKey = k.toLowerCase().trim();
    normalizedValues[lowerKey] = v;
    const stripped = lowerKey.startsWith('$') ? lowerKey.slice(1) : lowerKey;
    normalizedValues[stripped] = v;
    normalizedValues['$' + stripped] = v;
  }

  const resolveToken = (token: string): number => {
    const raw = token.trim();
    if (!raw) return 0;
    const lower = raw.toLowerCase();

    if (lower in normalizedValues) return normalizedValues[lower];
    const stripped = lower.startsWith('$') ? lower.slice(1) : lower;
    if (stripped in normalizedValues) return normalizedValues[stripped];

    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const evaluateClause = (clause: string): boolean => {
    const trimmed = clause
      .trim()
      .replace(/^\(|\)$/g, '')
      .trim();
    if (!trimmed) return true;

    // Relational operators (check multi-character operators first)
    for (const op of ['>=', '<=', '!=', '==', '>', '<'] as const) {
      if (trimmed.includes(op)) {
        const [leftStr, rightStr] = trimmed.split(op).map((s) => s.trim());
        const leftVal = resolveToken(leftStr);
        const rightVal = resolveToken(rightStr);

        switch (op) {
          case '==':
            return leftVal === rightVal;
          case '!=':
            return leftVal !== rightVal;
          case '>=':
            return leftVal >= rightVal;
          case '<=':
            return leftVal <= rightVal;
          case '>':
            return leftVal > rightVal;
          case '<':
            return leftVal < rightVal;
        }
      }
    }

    // Negation: e.g. !$cloth or !cloth
    if (trimmed.startsWith('!')) {
      const inner = trimmed.slice(1).trim();
      return resolveToken(inner) === 0;
    }

    // Truthy variable check
    return resolveToken(trimmed) !== 0;
  };

  // Top-level disjunctions (|| has lower precedence than &&)
  const orBranches = expr
    .split('||')
    .map((b) => b.trim())
    .filter(Boolean);
  if (orBranches.length === 0) return true;

  return orBranches.some((branch) => {
    const andClauses = branch
      .split('&&')
      .map((c) => c.trim())
      .filter(Boolean);
    return andClauses.every((clause) => evaluateClause(clause));
  });
}

interface ModeMaterials {
  diffuse?: THREE.MeshStandardMaterial;
  clay?: THREE.MeshStandardMaterial;
  normal?: THREE.MeshNormalMaterial;
}

function applyMaterialMode(mesh: THREE.Mesh, mode: RenderMode, wireframe: boolean) {
  const orig = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
  if (!orig) return;

  if (!mesh.userData.modeMaterials) {
    mesh.userData.modeMaterials = {} as ModeMaterials;
  }
  const cache = mesh.userData.modeMaterials as ModeMaterials;

  if (mode === 'pbr') {
    orig.wireframe = wireframe;
    mesh.material = orig;
  } else if (mode === 'diffuse') {
    if (!cache.diffuse) {
      cache.diffuse = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: mesh.userData.diffuseTexture || null,
        side: THREE.DoubleSide,
        roughness: 0.85,
        metalness: 0.0,
      });
    }
    cache.diffuse.wireframe = wireframe;
    mesh.material = cache.diffuse;
  } else if (mode === 'clay') {
    if (!cache.clay) {
      cache.clay = new THREE.MeshStandardMaterial({
        color: 0xc4c4c4,
        side: THREE.DoubleSide,
        roughness: 0.55,
        metalness: 0.0,
      });
    }
    cache.clay.wireframe = wireframe;
    mesh.material = cache.clay;
  } else if (mode === 'normal') {
    if (!cache.normal) {
      cache.normal = new THREE.MeshNormalMaterial({
        side: THREE.DoubleSide,
      });
    }
    cache.normal.wireframe = wireframe;
    mesh.material = cache.normal;
  }
}

function disposeThreeMesh(child: THREE.Object3D) {
  if (child instanceof THREE.Mesh) {
    child.geometry.dispose();

    // Dispose cached mode materials
    const modeMats = child.userData.modeMaterials as ModeMaterials | undefined;
    if (modeMats) {
      modeMats.diffuse?.dispose();
      modeMats.clay?.dispose();
      modeMats.normal?.dispose();
    }

    // Dispose original material
    const orig = child.userData.originalMaterial as THREE.Material | undefined;
    if (orig && orig !== child.material) {
      orig.dispose();
    }

    // Dispose current material if not already disposed
    if (child.material instanceof THREE.Material) {
      if ('map' in child.material && child.material.map instanceof THREE.Texture) {
        child.material.map.dispose();
      }
      child.material.dispose();
    }

    // Dispose all associated textures
    for (const key of ['diffuseTexture', 'normalTexture', 'lightTexture', 'materialTexture']) {
      const tex = child.userData[key] as THREE.Texture | undefined;
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
      }
    }
  }
}

export function useThreeScene(containerRef: React.RefObject<HTMLDivElement | null>): ThreeSceneAPI {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const animFrameRef = useRef<number>(0);
  const needsRenderRef = useRef<boolean>(true);

  // Lights
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);

  // Render options state
  const renderModeRef = useRef<RenderMode>('diffuse');
  const wireframeRef = useRef<boolean>(false);
  const turntableRef = useRef<boolean>(false);

  // Initialize scene on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x1a1a2e, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Mesh group
    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      1000
    );
    camera.position.set(0, 1.5, 3);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 1, 0);
    controls.update();
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(3, 8, 6);
    directionalLight.castShadow = false;
    scene.add(directionalLight);
    dirLightRef.current = directionalLight;

    const fillLight = new THREE.DirectionalLight(0xeeeeff, 0.45);
    fillLight.position.set(-4, 4, -4);
    scene.add(fillLight);
    fillLightRef.current = fillLight;

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x333344, 0.45);
    scene.add(hemisphereLight);
    hemiLightRef.current = hemisphereLight;

    // Grid helper
    const grid = new THREE.GridHelper(10, 20, 0x444444, 0x333333);
    scene.add(grid);
    gridRef.current = grid;

    // Render loop (on-demand via controls change)
    needsRenderRef.current = true;
    controls.addEventListener('change', () => {
      needsRenderRef.current = true;
    });

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      if (turntableRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 2.0;
        needsRenderRef.current = true;
      } else {
        controls.autoRotate = false;
      }
      controls.update();
      if (needsRenderRef.current) {
        renderer.render(scene, camera);
        needsRenderRef.current = false;
      }
    }
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      needsRenderRef.current = true;
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (meshGroupRef.current) {
        while (meshGroupRef.current.children.length > 0) {
          const child = meshGroupRef.current.children[0];
          meshGroupRef.current.remove(child);
          disposeThreeMesh(child);
        }
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [containerRef]);

  const setMeshes = useCallback((builtMeshes: BuiltMesh[]) => {
    const group = meshGroupRef.current;
    if (!group) return;

    // Reset group rotation on new mesh load
    group.rotation.set(0, 0, 0);

    // Clear existing
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeThreeMesh(child);
    }

    // Add new meshes with current render mode applied
    for (const built of builtMeshes) {
      applyMaterialMode(built.mesh, renderModeRef.current, wireframeRef.current);
      group.add(built.mesh);
    }

    // Trigger re-render
    needsRenderRef.current = true;
  }, []);

  const clear = useCallback(() => {
    setMeshes([]);
  }, [setMeshes]);

  const resize = useCallback(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!container || !camera || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    needsRenderRef.current = true;
  }, [containerRef]);

  const requestRender = useCallback(() => {
    needsRenderRef.current = true;
  }, []);

  const fitCamera = useCallback(() => {
    const group = meshGroupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!group || !camera || !controls || group.children.length === 0) return;

    // Compute bounding box of all meshes
    const box = new THREE.Box3();
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        const childBox = child.geometry.boundingBox;
        if (childBox) {
          childBox.applyMatrix4(child.matrixWorld);
          box.union(childBox);
        }
      }
    });

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.35;

    // Position grid at the base/feet of the character
    if (gridRef.current) {
      gridRef.current.position.set(center.x, box.min.y, center.z);
      const gridScale = Math.max(1, maxDim * 0.4);
      gridRef.current.scale.set(gridScale, gridScale, gridScale);
    }

    // Aim directly at center and position camera in front
    camera.position.set(center.x, center.y + size.y * 0.1, center.z + distance);
    controls.target.copy(center);
    controls.update();

    // Update near/far planes
    camera.near = distance * 0.01;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
    needsRenderRef.current = true;
  }, []);

  const setCameraPreset = useCallback(
    (preset: CameraPreset) => {
      if (preset === 'reset') {
        fitCamera();
        return;
      }

      const group = meshGroupRef.current;
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!group || !camera || !controls || group.children.length === 0) return;

      const box = new THREE.Box3();
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.computeBoundingBox();
          const childBox = child.geometry.boundingBox;
          if (childBox) {
            childBox.applyMatrix4(child.matrixWorld);
            box.union(childBox);
          }
        }
      });

      if (box.isEmpty()) return;

      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.35;

      if (preset === 'front') {
        camera.position.set(center.x, center.y + size.y * 0.05, center.z + distance);
        controls.target.copy(center);
      } else if (preset === 'back') {
        camera.position.set(center.x, center.y + size.y * 0.05, center.z - distance);
        controls.target.copy(center);
      } else if (preset === 'left') {
        camera.position.set(center.x - distance, center.y + size.y * 0.05, center.z);
        controls.target.copy(center);
      } else if (preset === 'right') {
        camera.position.set(center.x + distance, center.y + size.y * 0.05, center.z);
        controls.target.copy(center);
      } else if (preset === 'face') {
        const faceY = box.max.y - size.y * 0.15;
        const faceCenter = new THREE.Vector3(center.x, faceY, center.z);
        const faceDistance = Math.max(0.4, distance * 0.32);
        camera.position.set(center.x, faceY, center.z + faceDistance);
        controls.target.copy(faceCenter);
      }

      controls.update();
      needsRenderRef.current = true;
    },
    [fitCamera]
  );

  const setTurntable = useCallback((enabled: boolean) => {
    turntableRef.current = enabled;
    const controls = controlsRef.current;
    if (controls) {
      controls.autoRotate = enabled;
      controls.autoRotateSpeed = 2.0;
    }
    needsRenderRef.current = true;
  }, []);

  const rotateModelY = useCallback((angle = Math.PI / 2) => {
    const group = meshGroupRef.current;
    if (!group) return;
    group.rotation.y += angle;
    needsRenderRef.current = true;
  }, []);

  const setRenderMode = useCallback((mode: RenderMode) => {
    renderModeRef.current = mode;
    const group = meshGroupRef.current;
    if (!group) return;

    for (const child of group.children) {
      if (child instanceof THREE.Mesh) {
        applyMaterialMode(child, mode, wireframeRef.current);
      }
    }
    needsRenderRef.current = true;
  }, []);

  const setWireframe = useCallback((enabled: boolean) => {
    wireframeRef.current = enabled;
    const group = meshGroupRef.current;
    if (!group) return;

    for (const child of group.children) {
      if (child instanceof THREE.Mesh) {
        applyMaterialMode(child, renderModeRef.current, enabled);
      }
    }
    needsRenderRef.current = true;
  }, []);

  const setLightingPreset = useCallback((preset: LightingPreset) => {
    const amb = ambientLightRef.current;
    const dir = dirLightRef.current;
    const fill = fillLightRef.current;
    const hemi = hemiLightRef.current;
    if (!amb || !dir || !fill || !hemi) return;

    if (preset === 'studio') {
      amb.color.setHex(0xffffff);
      amb.intensity = 0.6;
      dir.color.setHex(0xffffff);
      dir.intensity = 1.2;
      dir.position.set(5, 10, 7);
      fill.color.setHex(0x8888ff);
      fill.intensity = 0.4;
      hemi.color.setHex(0xb1e1ff);
      hemi.groundColor.setHex(0x444444);
      hemi.intensity = 0.5;
    } else if (preset === 'anime') {
      amb.color.setHex(0xffffff);
      amb.intensity = 1.1;
      dir.color.setHex(0xffffff);
      dir.intensity = 0.7;
      dir.position.set(2, 6, 6);
      fill.color.setHex(0xffffff);
      fill.intensity = 0.5;
      hemi.color.setHex(0xffffff);
      hemi.groundColor.setHex(0x888888);
      hemi.intensity = 0.7;
    } else if (preset === 'dramatic') {
      amb.color.setHex(0x222233);
      amb.intensity = 0.3;
      dir.color.setHex(0xffffff);
      dir.intensity = 2.0;
      dir.position.set(6, 8, 4);
      fill.color.setHex(0x3355aa);
      fill.intensity = 0.8;
      hemi.color.setHex(0x223344);
      hemi.groundColor.setHex(0x111122);
      hemi.intensity = 0.2;
    }
    needsRenderRef.current = true;
  }, []);

  const setMeshVisibility = useCallback((index: number, visible: boolean) => {
    const group = meshGroupRef.current;
    if (!group || index < 0 || index >= group.children.length) return;
    group.children[index].visible = visible;
    needsRenderRef.current = true;
  }, []);

  const applyToggles = useCallback((toggleValues: Record<string, number>) => {
    const group = meshGroupRef.current;
    if (!group) return;

    for (const child of group.children) {
      if (child instanceof THREE.Mesh) {
        const cond = child.userData.condition;
        if (cond) {
          const visible = evaluateCondition(cond, toggleValues);
          child.visible = visible;
        }
      }
    }
    needsRenderRef.current = true;
  }, []);

  const captureSnapshot = useCallback((): string | null => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const grid = gridRef.current;
    if (!renderer || !scene || !camera) return null;

    // Temporarily hide grid helper so only the 3D model and scene background are captured
    const wasGridVisible = grid ? grid.visible : false;
    if (grid) {
      grid.visible = false;
    }

    // Force a render pass with current camera angle and meshes
    renderer.render(scene, camera);

    // Capture clean PNG data URL
    const dataUrl = renderer.domElement.toDataURL('image/png');

    // Restore grid visibility
    if (grid) {
      grid.visible = wasGridVisible;
    }
    needsRenderRef.current = true;

    return dataUrl;
  }, []);

  return useMemo(
    () => ({
      setMeshes,
      clear,
      requestRender,
      resize,
      fitCamera,
      setCameraPreset,
      setTurntable,
      rotateModelY,
      setRenderMode,
      setWireframe,
      setLightingPreset,
      setMeshVisibility,
      applyToggles,
      captureSnapshot,
    }),
    [
      setMeshes,
      clear,
      requestRender,
      resize,
      fitCamera,
      setCameraPreset,
      setTurntable,
      rotateModelY,
      setRenderMode,
      setWireframe,
      setLightingPreset,
      setMeshVisibility,
      applyToggles,
      captureSnapshot,
    ]
  );
}
