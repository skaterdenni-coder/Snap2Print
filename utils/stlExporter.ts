import { Platform } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resizeGLBToBytes } from './modelResizer';
import { proxyUrl } from './tripo';

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
        try {
          const res = await fetch(glbUrl);
          if (res.ok) {
            arrayBuffer = await res.arrayBuffer();
          } else {
            throw new Error('Direct fetch failed');
          }
        } catch (e) {
          const proxyRes = await fetch(proxyUrl(glbUrl));
          if (!proxyRes.ok) throw new Error('Download failed');
          arrayBuffer = await proxyRes.arrayBuffer();
        }
        return new Uint8Array(arrayBuffer);
      })();

  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(glbBytes);

  const triangles: { v1: [number, number, number]; v2: [number, number, number]; v3: [number, number, number] }[] = [];

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const posAccessor = primitive.getAttribute('POSITION');
      const indexAccessor = primitive.getIndex();
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
    const blob = new Blob([stlBytes.buffer as ArrayBuffer], { type: 'model/stl' });
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
