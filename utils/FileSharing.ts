import { Platform } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { resizeGLB, resizeGLBToBytes } from './modelResizer';
import { proxyUrl } from './tripo';

/**
 * Lädt ein GLB-Modell zu Litterbox hoch.
 * Unterstützt optionales Skalieren vor dem Upload.
 * Speicherdauer ist fest auf 24h eingestellt.
 */
export async function uploadToLitterbox(
  glbUrl: string,
  targetHeightMeters?: number
): Promise<string> {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('time', '24h');

  // Im Web tunneln wir den glbUrl Download durch unseren Proxy
  const sourceUrl = proxyUrl(glbUrl);

  if (targetHeightMeters) {
    if (Platform.OS === 'web') {
      const resizedBlob = await resizeGLB(sourceUrl, targetHeightMeters);
      formData.append('fileToUpload', new File([resizedBlob], 'model.glb', { type: 'model/gltf-binary' }));
    } else {
      const bytes = await resizeGLBToBytes(glbUrl, targetHeightMeters);
      const file = new ExpoFile(Paths.cache, `scaled-model-${Date.now()}.glb`);
      file.write(bytes);

      // @ts-ignore React Native accepts file descriptors in FormData.
      formData.append('fileToUpload', {
        uri: file.uri,
        name: 'model.glb',
        type: 'model/gltf-binary'
      });
    }
  } else {
    if (Platform.OS === 'web') {
      const res = await fetch(sourceUrl);
      const blob = await res.blob();
      formData.append('fileToUpload', new File([blob], 'model.glb', { type: 'model/gltf-binary' }));
    } else {
      // @ts-ignore React Native accepts file descriptors in FormData.
      formData.append('fileToUpload', {
        uri: glbUrl,
        name: 'model.glb',
        type: 'model/gltf-binary'
      });
    }
  }

  const uploadRes = await fetch(proxyUrl('https://litterbox.catbox.moe/resources/internals/api.php'), {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}`);
  }

  const litterboxUrl = (await uploadRes.text()).trim();
  if (!litterboxUrl.startsWith('http')) {
    throw new Error(`Upload failed: ${litterboxUrl}`);
  }

  return litterboxUrl;
}

/**
 * Lädt rohe Binärdaten (z. B. konvertierte STL-Bytes) zu Litterbox hoch.
 */
export async function uploadBytesToLitterbox(
  bytes: Uint8Array,
  filename: string = 'model.stl',
  mimeType: string = 'model/stl'
): Promise<string> {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('time', '24h');

  if (Platform.OS === 'web') {
    formData.append('fileToUpload', new File([bytes.buffer as ArrayBuffer], filename, { type: mimeType }));
  } else {
    const file = new ExpoFile(Paths.cache, `upload-${Date.now()}-${filename}`);
    file.write(bytes);

    // @ts-ignore
    formData.append('fileToUpload', {
      uri: file.uri,
      name: filename,
      type: mimeType
    });
  }

  const uploadRes = await fetch(proxyUrl('https://litterbox.catbox.moe/resources/internals/api.php'), {
    method: 'POST',
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}`);
  }

  const litterboxUrl = (await uploadRes.text()).trim();
  if (!litterboxUrl.startsWith('http')) {
    throw new Error(`Upload failed: ${litterboxUrl}`);
  }

  return litterboxUrl;
}
