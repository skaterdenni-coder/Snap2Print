const MESHY_BASE_URL = 'https://api.meshy.ai/openapi/v1';

export interface MeshyTask {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  progress: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  thumbnail_url?: string;
  created_at: string;
  name?: string;
}

export async function createImageTo3DTask(
  apiKey: string,
  imagesBase64: string[],
  mode: 'preview' | 'refine' = 'preview',
): Promise<string> {
  console.log('[Meshy] Sende Task an API. Bilder insgesamt:', imagesBase64.length);

  const body: any = {
    image_url: imagesBase64[0], // Hauptbild (Pflichtfeld)
    mode,
    enable_pbr: true,
    should_remesh: true,
  };

  // Wenn mehr als ein Bild da ist, sende die restlichen als zusätzliche Ansichten
  if (imagesBase64.length > 1) {
    body.image_urls = imagesBase64.slice(1);
    console.log('[Meshy] Multi-View aktiv. Zusätzliche Ansichten:', body.image_urls.length);
  }

  const response = await fetch(`${MESHY_BASE_URL}/image-to-3d`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Meshy] API Fehler:', error);
    throw new Error(`API Fehler: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('[Meshy] Task erfolgreich erstellt. ID:', data.result);
  return data.result;
}

export async function getTaskStatus(apiKey: string, taskId: string): Promise<MeshyTask> {
  const response = await fetch(`${MESHY_BASE_URL}/image-to-3d/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Status Fehler: ${response.status}`);
  return await response.json();
}

export async function imageUriToBase64DataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Konvertierung fehlgeschlagen'));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
