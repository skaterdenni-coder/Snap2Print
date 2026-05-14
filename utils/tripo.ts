import { Platform } from 'react-native';

const TRIPO_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';

export interface TripoTask {
  task_id: string;
  type: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown' | 'banned' | 'expired';
  progress: number;
  output?: {
    model?: string;
    pbr_model?: string;
    rendered_image?: string;
    [key: string]: any;
  };
  input?: any;
  [key: string]: any;
}

async function safeParseJson(response: Response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`API Fehler (${response.status}): Server antwortete nicht im JSON-Format.`);
  }
  return await response.json();
}

async function uploadToTripo(apiKey: string, uri: string): Promise<string> {
  const formData = new FormData();
  const filename = uri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  // @ts-ignore
  formData.append('file', {
    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
    name: filename,
    type: type,
  });

  const response = await fetch(`${TRIPO_BASE_URL}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
    body: formData,
  });

  const data = await safeParseJson(response);
  if (data.code !== 0) throw new Error(data.message);
  return data.data.image_token || data.data.file_token;
}

/**
 * Erstellt den Draft und gibt zusätzlich die Tokens zurück.
 */
export async function createTripoTask(
  apiKey: string,
  imageUris: (string | null)[],
  quality: 'fast' | 'detailed' = 'detailed'
): Promise<{ taskId: string; tokens: string[] }> {
  const validUris = imageUris.filter((u): u is string => u !== null);
  const isSingleView = validUris.length === 1;

  console.log(`[Tripo] Starte ${isSingleView ? 'Singleview' : 'Multiview'} Task (V3.1)`);

  const tokens = await Promise.all(imageUris.map(async (uri) => {
    if (!uri) return null;
    return await uploadToTripo(apiKey, uri);
  }));

  const validTokens = tokens.filter((t): t is string => t !== null);

  let body: any;

  if (isSingleView) {
    body = {
      type: 'image_to_model',
      model_version: 'v3.1-20260211',
      file: {
        type: 'jpg',
        file_token: validTokens[0]
      }
    };
  } else {
    // Tripo Multiview Reihenfolge: Front, Left, Back, Right (0, 1, 3, 2)
    const tripoOrder = [tokens[0], tokens[1], tokens[3], tokens[2]];
    const files = tripoOrder.map(token => token ? { type: 'jpg', file_token: token } : {});

    body = {
      type: 'multiview_to_model',
      model_version: 'v3.1-20260211',
      files: files,
    };
  }

  // Parameter hinzufügen
  Object.assign(body, {
    face_limit: quality === 'fast' ? 500000 : 2000000,
    texture: true,
    pbr: true,
    texture_quality: quality === 'fast' ? 'standard' : 'detailed',
    geometry_quality: 'standard',
    texture_alignment: 'original_image',
    orientation: 'align_image',
    orthographic_projection: false
  });

  const response = await fetch(`${TRIPO_BASE_URL}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await safeParseJson(response);
  if (data.code !== 0) throw new Error(data.message);

  return { taskId: data.data.task_id, tokens: validTokens };
}

/**
 * Nutzt die Original-Bilder (Tokens) für das Refinement.
 * Dies erzwingt die Web-Parität für Schärfe und Farben.
 */
export async function createTripoRefineTask(
  apiKey: string,
  draftTaskId: string,
  imageTokens: string[],
  quality: 'fast' | 'detailed' = 'detailed'
): Promise<string> {
  console.log('[Tripo] Starte Refine Task (v3.0) mit Bild-Referenzen');

  const body = {
    type: 'texture_model',
    model_version: quality === 'fast' ? 'v3.0-20250812' : 'v3.0-20250812', // Gleiche Version, andere Parameter
    original_model_task_id: draftTaskId,
    texture_prompt: {
      // WICHTIG: Die Bilder-Tokens sorgen für das scharfe Kennzeichen
      images: imageTokens.map(token => ({
        file: {
          type: 'jpg',
          file_token: token
        }
      }))
    },
    texture: true,
    pbr: true,
    texture_quality: quality === 'fast' ? 'standard' : 'detailed', // 4K Upscale nur bei detailed
    texture_alignment: 'original_image',
    bake: true
  };

  const response = await fetch(`${TRIPO_BASE_URL}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await safeParseJson(response);
  if (data.code !== 0) throw new Error(data.message);
  return data.data.task_id;
}

export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
  });
  const data = await safeParseJson(response);
  return { ...data.data, task_id: data.data.task_id };
}

export function mapTripoStatus(tripoStatus: string): any {
  const map: any = { queued: 'PENDING', running: 'IN_PROGRESS', success: 'SUCCEEDED', failed: 'FAILED', cancelled: 'EXPIRED', expired: 'EXPIRED' };
  return map[tripoStatus] || 'FAILED';
}

export async function imageUriToBase64DataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
