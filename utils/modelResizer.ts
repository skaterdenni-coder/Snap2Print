import { WebIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { proxyUrl } from './tripo';

/**
 * Lädt ein GLB, skaliert es auf die Zielhöhe (Y-Achse) und gibt es als Binärdaten zurück.
 */
export async function resizeGLBToBytes(url: string, targetHeight: number): Promise<Uint8Array> {
  try {
    const io = new WebIO();
    const sourceUrl = proxyUrl(url);
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error('Download fehlgeschlagen');

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const document = await io.readBinary(uint8Array);
    const root = document.getRoot();

    const scenes = root.listScenes();
    const bounds = scenes.reduce(
      (combined, scene) => {
        const sceneBounds = getBounds(scene);
        return {
          min: [
            Math.min(combined.min[0], sceneBounds.min[0]),
            Math.min(combined.min[1], sceneBounds.min[1]),
            Math.min(combined.min[2], sceneBounds.min[2]),
          ],
          max: [
            Math.max(combined.max[0], sceneBounds.max[0]),
            Math.max(combined.max[1], sceneBounds.max[1]),
            Math.max(combined.max[2], sceneBounds.max[2]),
          ],
        };
      },
      {
        min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
        max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
      }
    );

    // Tripo/AR-Viewer nutzen Y als vertikale Höhe (index 1).
    const currentSizeY = bounds.max[1] - bounds.min[1];

    if (currentSizeY <= 0) {
      console.warn('Konnte Höhe nicht bestimmen, überspringe Skalierung');
      return uint8Array;
    }

    const scaleFactor = targetHeight / currentSizeY;
    console.log(`[Resizer] Aktuelle Y-Höhe: ${currentSizeY}m, Ziel: ${targetHeight}m, Faktor: ${scaleFactor}`);

    // Skalierung auf die Root-Nodes aller Szenen anwenden
    root.listScenes().forEach(scene => {
      scene.listChildren().forEach(node => {
        const currentScale = node.getScale();
        node.setScale([
          currentScale[0] * scaleFactor,
          currentScale[1] * scaleFactor,
          currentScale[2] * scaleFactor
        ]);
      });
    });

    const outBinary = await io.writeBinary(document);
    return new Uint8Array(outBinary);
  } catch (error) {
    console.error('ResizeGLB Error:', error);
    throw error;
  }
}

/**
 * Web-Helfer: Gibt das skalierte GLB als Blob zurück.
 * Native Code sollte resizeGLBToBytes() nutzen, weil React Native keine Blobs
 * direkt aus ArrayBuffer/ArrayBufferView erzeugen kann.
 */
export async function resizeGLB(url: string, targetHeight: number): Promise<Blob> {
  const bytes = await resizeGLBToBytes(url, targetHeight);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'model/gltf-binary' });
}
