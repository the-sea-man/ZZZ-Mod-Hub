/**
 * Mesh factory: converts IPC binary payloads into Three.js geometry.
 *
 * Decodes base64 LE Float32/Uint32 arrays from the Rust backend and
 * builds BufferGeometry + MeshStandardMaterial for each draw call.
 */

import * as THREE from 'three';
import type { ViewerMeshData } from '../../types/ipc';

/** Decode a base64 string into a Float32Array (LE). */
function decodeF32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

/** Decode a base64 string into a Uint32Array (LE). */
function decodeU32(b64: string): Uint32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Uint32Array(bytes.buffer);
}

/** Fallback color when no texture is available, derived from component name. */
function fallbackColor(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('hair')) return 0xa0d8ef;
  if (n.includes('body') || n.includes('top')) return 0xf5cba7;
  if (n.includes('leg') || n.includes('bottom')) return 0xf7dc6f;
  if (n.includes('head') || n.includes('face')) return 0xffe0bd;
  if (n.includes('weapon')) return 0xadd8e6;
  return 0xcccccc;
}

export interface BuiltMesh {
  mesh: THREE.Mesh;
  name: string;
  component: string | null;
  condition: string | null;
  vertexCount: number;
  triangleCount: number;
}

/**
 * Build a Three.js Mesh from a ViewerMeshData payload.
 */
export function buildMesh(
  data: ViewerMeshData,
  textures: Record<string, string>,
  onTextureLoaded?: () => void
): BuiltMesh {
  const geo = new THREE.BufferGeometry();

  // Positions
  const positions = decodeF32(data.positions);
  const vertexCount = Math.floor(positions.length / 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // UVs
  if (data.uvs) {
    const uvs = decodeF32(data.uvs);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    // Also duplicate as uv2 for lightMap / aoMap support
    geo.setAttribute('uv2', new THREE.BufferAttribute(uvs, 2));
  }

  // Indices
  const indices = decodeU32(data.indices);
  const triangleCount =
    indices.length > 0 ? Math.floor(indices.length / 3) : Math.floor(vertexCount / 3);
  geo.setIndex(new THREE.BufferAttribute(indices, 1));

  // Compute normals from geometry (we don't have authored normals)
  geo.computeVertexNormals();

  // Material
  const color = fallbackColor(data.name);
  const matParams: THREE.MeshStandardMaterialParameters = {
    color,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.1,
  };

  const loader = new THREE.TextureLoader();
  let diffuseTexture: THREE.Texture | null = null;
  let normalTexture: THREE.Texture | null = null;
  let lightTexture: THREE.Texture | null = null;
  let materialTexture: THREE.Texture | null = null;

  let matInstance: THREE.MeshStandardMaterial | null = null;
  const onTexLoad = () => {
    if (matInstance) {
      matInstance.needsUpdate = true;
    }
    onTextureLoaded?.();
  };

  // 1. Diffuse texture (ps-t0)
  if (data.tex_key && textures[data.tex_key]) {
    const dataUri = textures[data.tex_key];
    diffuseTexture = loader.load(dataUri, onTexLoad);
    diffuseTexture.colorSpace = THREE.SRGBColorSpace;
    diffuseTexture.flipY = true;
    matParams.map = diffuseTexture;
    matParams.color = 0xffffff; // Let texture color through
    matParams.alphaTest = 0.05;
  }

  // 2. Normal map (ps-t1)
  if (data.normal_key && textures[data.normal_key]) {
    normalTexture = loader.load(textures[data.normal_key], onTexLoad);
    normalTexture.colorSpace = THREE.NoColorSpace;
    normalTexture.flipY = true;
    matParams.normalMap = normalTexture;
    // DirectX normal maps have inverted green (Y) channel compared to WebGL; keep scale subtle
    matParams.normalScale = new THREE.Vector2(0.4, -0.4);
  }

  // 3. Light map (ps-t2) - Hoyoverse Cel-Shading Ramp / shadow boundary mask
  if (data.light_key && textures[data.light_key]) {
    lightTexture = loader.load(textures[data.light_key], onTexLoad);
    lightTexture.colorSpace = THREE.LinearSRGBColorSpace;
    lightTexture.flipY = true;
    // Note: Do not bind as matParams.lightMap to prevent harsh anime shadow splotches
  }

  // 4. Material map (ps-t3)
  if (data.material_key && textures[data.material_key]) {
    materialTexture = loader.load(textures[data.material_key], onTexLoad);
    materialTexture.colorSpace = THREE.LinearSRGBColorSpace;
    materialTexture.flipY = true;
    // Clean anime material defaults (avoid raw non-PBR channel chrome artifacts)
    matParams.roughness = 0.75;
    matParams.metalness = 0.05;
  }

  const mat = new THREE.MeshStandardMaterial(matParams);
  matInstance = mat;
  const mesh = new THREE.Mesh(geo, mat);

  mesh.userData = {
    name: data.name,
    component: data.component,
    condition: data.condition || null,
    diffuseTexture,
    normalTexture,
    lightTexture,
    materialTexture,
    originalMaterial: mat,
  };

  return {
    mesh,
    name: data.name,
    component: data.component,
    condition: data.condition || null,
    vertexCount,
    triangleCount,
  };
}

/**
 * Build all meshes from a ViewerPayload and ensure they are oriented upright.
 */
export function buildAllMeshes(
  meshes: ViewerMeshData[],
  textures: Record<string, string>,
  onTextureLoaded?: () => void
): BuiltMesh[] {
  const built = meshes.map((data) => buildMesh(data, textures, onTextureLoaded));

  // Compute total bounding box of all meshes to determine coordinate orientation
  const totalBox = new THREE.Box3();
  for (const b of built) {
    b.mesh.geometry.computeBoundingBox();
    if (b.mesh.geometry.boundingBox) {
      totalBox.union(b.mesh.geometry.boundingBox);
    }
  }

  // 3DMigoto models dump vertex buffers in DirectX space where Z is the vertical/height axis.
  // In Three.js, Y is the vertical axis.
  // If the model's Z extent is larger than its Y extent (i.e. model is lying face-down/flat),
  // rotate -90° around X to bring the model upright.
  if (!totalBox.isEmpty()) {
    const totalSize = totalBox.getSize(new THREE.Vector3());
    if (totalSize.z > totalSize.y * 1.2 || totalSize.z > totalSize.x * 1.2) {
      for (const b of built) {
        b.mesh.geometry.rotateX(-Math.PI / 2);
        b.mesh.geometry.computeVertexNormals();
        b.mesh.geometry.computeBoundingBox();
      }
    }
  }

  return built;
}
