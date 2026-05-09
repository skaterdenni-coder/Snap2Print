import { WebIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

/**
 * Lädt ein GLB, skaliert es auf die Zielhöhe (Z-Achse) und gibt es als Blob zurück.
 */
export async function resizeGLB(url: string, targetHeight: number): Promise<Blob> {
  try {
    const io = new WebIO();
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download fehlgeschlagen');

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const document = await io.readBinary(uint8Array);
    const root = document.getRoot();

    const bounds = getBounds(root);
    // Wir nehmen die Z-Achse als Höhe (index 2)
    const currentSizeZ = bounds.max[2] - bounds.min[2];

    if (currentSizeZ <= 0) {
      console.warn('Konnte Höhe nicht bestimmen, überspringe Skalierung');
      return new Blob([uint8Array], { type: 'model/gltf-binary' });
    }

    const scaleFactor = targetHeight / currentSizeZ;
    console.log(`[Resizer] Aktuelle Z-Höhe: ${currentSizeZ}m, Ziel: ${targetHeight}m, Faktor: ${scaleFactor}`);

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
    return new Blob([outBinary], { type: 'model/gltf-binary' });
  } catch (error) {
    console.error('ResizeGLB Error:', error);
    throw error;
  }
}
