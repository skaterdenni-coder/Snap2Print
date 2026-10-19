import { Platform } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resizeGLBToBytes } from './modelResizer';
import { proxyUrl } from './tripo';

// 4x4 Identity Matrix
const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
];

// Erzeugt 4x4 Spaltenmatrix aus Translation, Quaternion-Rotation und Skalierung
function composeTRS(
  translation: [number, number, number],
  rotation: [number, number, number, number],
  scale: [number, number, number]
): number[] {
  const [x, y, z] = translation;
  const [qx, qy, qz, qw] = rotation;
  const [sx, sy, sz] = scale;

  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,

    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,

    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,

    x,
    y,
    z,
    1
  ];
}

// Multipliziert zwei 4x4 Matrizen (a * b)
function multiplyMatrix(a: number[], b: number[]): number[] {
  const out = new Array(16);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
  out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
  out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
  out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

  return out;
}

/**
 * Konvertiert ein GLB-Modell (optional skaliert auf Zielhöhe) in Binär-STL-Bytes.
 */
export async function convertGLBToSTLBytes(
  glbUrl: string,
  targetHeightMeters?: number
): Promise<Uint8Array> {
  const glbBytes = targetHeightMeters
    ? await resizeGLBToBytes(glbUrl, targetHeightMeters)
    : await (async () => {
        let arrayBuffer: ArrayBuffer;
        const sourceUrl = proxyUrl(glbUrl);
        try {
          const res = await fetch(sourceUrl);
          if (res.ok) {
            arrayBuffer = await res.arrayBuffer();
          } else {
            throw new Error('Proxy fetch failed');
          }
        } catch (e) {
          const directRes = await fetch(glbUrl);
          if (!directRes.ok) throw new Error('Download failed');
          arrayBuffer = await directRes.arrayBuffer();
        }
        return new Uint8Array(arrayBuffer);
      })();

  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(glbBytes);

  const triangles: { v1: [number, number, number]; v2: [number, number, number]; v3: [number, number, number] }[] = [];

  const processNode = (node: any, parentMatrix: number[]) => {
    let nodeMatrix: number[];
    const rawMatrix = node.getMatrix();
    if (rawMatrix && rawMatrix.length === 16) {
      nodeMatrix = Array.from(rawMatrix);
    } else {
      const translation = node.getTranslation() ?? [0, 0, 0];
      const rotation = node.getRotation() ?? [0, 0, 0, 1];
      const scale = node.getScale() ?? [1, 1, 1];
      nodeMatrix = composeTRS(translation, rotation, scale);
    }

    const worldMatrix = multiplyMatrix(parentMatrix, nodeMatrix);

    const mesh = node.getMesh();
    if (mesh) {
      for (const primitive of mesh.listPrimitives()) {
        const posAccessor = primitive.getAttribute('POSITION');
        const indexAccessor = primitive.getIndices ? primitive.getIndices() : (primitive as any).getIndex?.();
        if (!posAccessor) continue;

        const positions = posAccessor.getArray() as Float32Array;
        const indices = indexAccessor ? (indexAccessor.getArray() as Uint16Array | Uint32Array) : null;

        const getVertex = (idx: number): [number, number, number] => {
          const x = positions[idx * 3];
          const y = positions[idx * 3 + 1];
          const z = positions[idx * 3 + 2];

          // Transformation mit Node WorldMatrix (4x4 Matrix spaltenweise)
          const tx = worldMatrix[0] * x + worldMatrix[4] * y + worldMatrix[8] * z + worldMatrix[12];
          const ty = worldMatrix[1] * x + worldMatrix[5] * y + worldMatrix[9] * z + worldMatrix[13];
          const tz = worldMatrix[2] * x + worldMatrix[6] * y + worldMatrix[10] * z + worldMatrix[14];

          return [tx, ty, tz];
        };

        if (indices) {
          for (let i = 0; i < indices.length; i += 3) {
            triangles.push({
              v1: getVertex(indices[i]),
              v2: getVertex(indices[i + 1]),
              v3: getVertex(indices[i + 2]),
            });
          }
        } else {
          for (let i = 0; i < positions.length / 3; i += 3) {
            triangles.push({
              v1: getVertex(i),
              v2: getVertex(i + 1),
              v3: getVertex(i + 2),
            });
          }
        }
      }
    }

    for (const child of node.listChildren()) {
      processNode(child, worldMatrix);
    }
  };

  const scenes = document.getRoot().listScenes();
  if (scenes.length > 0) {
    for (const scene of scenes) {
      for (const child of scene.listChildren()) {
        processNode(child, IDENTITY_MATRIX);
      }
    }
  } else {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const posAccessor = primitive.getAttribute('POSITION');
        const indexAccessor = primitive.getIndices ? primitive.getIndices() : (primitive as any).getIndex?.();
        if (!posAccessor) continue;

        const positions = posAccessor.getArray() as Float32Array;
        const indices = indexAccessor ? (indexAccessor.getArray() as Uint16Array | Uint32Array) : null;

        const getVertex = (idx: number): [number, number, number] => {
          return [positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]];
        };

        if (indices) {
          for (let i = 0; i < indices.length; i += 3) {
            triangles.push({
              v1: getVertex(indices[i]),
              v2: getVertex(indices[i + 1]),
              v3: getVertex(indices[i + 2]),
            });
          }
        } else {
          for (let i = 0; i < positions.length / 3; i += 3) {
            triangles.push({
              v1: getVertex(i),
              v2: getVertex(i + 1),
              v3: getVertex(i + 2),
            });
          }
        }
      }
    }
  }

  const numTriangles = triangles.length;
  const bufferSize = 80 + 4 + numTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const dataView = new DataView(buffer);

  const headerText = 'Snap2Print STL Exporter';
  for (let i = 0; i < Math.min(headerText.length, 80); i++) {
    dataView.setUint8(i, headerText.charCodeAt(i));
  }

  dataView.setUint32(80, numTriangles, true);

  let offset = 84;
  for (const tri of triangles) {
    const { v1, v2, v3 } = tri;

    const ax = v2[0] - v1[0], ay = v2[1] - v1[1], az = v2[2] - v1[2];
    const bx = v3[0] - v1[0], by = v3[1] - v1[1], bz = v3[2] - v1[2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    }

    dataView.setFloat32(offset, nx, true);
    dataView.setFloat32(offset + 4, ny, true);
    dataView.setFloat32(offset + 8, nz, true);
    offset += 12;

    dataView.setFloat32(offset, v1[0], true);
    dataView.setFloat32(offset + 4, v1[1], true);
    dataView.setFloat32(offset + 8, v1[2], true);
    offset += 12;

    dataView.setFloat32(offset, v2[0], true);
    dataView.setFloat32(offset + 4, v2[1], true);
    dataView.setFloat32(offset + 8, v2[2], true);
    offset += 12;

    dataView.setFloat32(offset, v3[0], true);
    dataView.setFloat32(offset + 4, v3[1], true);
    dataView.setFloat32(offset + 8, v3[2], true);
    offset += 12;

    dataView.setUint16(offset, 0, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

/**
 * Exportiert oder teilt das STL-Modell.
 */
export async function exportSTL(
  glbUrl: string,
  targetHeightMeters?: number,
  filename: string = 'model.stl',
  onProgress?: (label: string, progress: number) => void
): Promise<void> {
  onProgress?.('Konvertiere zu STL...', 30);
  const stlBytes = await convertGLBToSTLBytes(glbUrl, targetHeightMeters);
  onProgress?.('Speichere STL...', 80);

  if (Platform.OS === 'web') {
    const blob = new Blob([stlBytes], { type: 'model/stl' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } else {
    const file = new ExpoFile(Paths.cache, filename);
    file.write(stlBytes);

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      throw new Error('Sharing is not available on this device');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'model/stl',
      UTI: 'public.iso-standard-iso-10303-21',
      dialogTitle: 'STL-Modell exportieren',
    });
  }
}
