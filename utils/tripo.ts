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
  };
}

/**
 * Lädt eine Bilddatei über Multipart/Form-Data hoch.
 */
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
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(data.message);
  return data.data.image_token || data.data.file_token;
}

export async function createTripoTask(
  apiKey: string,
  imageUris: (string | null)[]
): Promise<string> {
  console.log('[Tripo] Starte High-Quality Multiview Task...');

  const tokens = await Promise.all(imageUris.map(async (uri) => {
    if (!uri) return null;
    return await uploadToTripo(apiKey, uri);
  }));

  const tripoOrder = [tokens[0], tokens[1], tokens[3], tokens[2]];
  const files = tripoOrder.map(token => token ? { type: 'jpg', file_token: token } : {});

  const body = {
    type: 'multiview_to_model',
    model_version: 'P1-20260311',
    files: files,
    face_limit: 50000, // Erhöht auf 50k für mobile AR (guter Kompromiss)
    texture: true,
    pbr: true,
    texture_quality: 'detailed', // Höhere Texturauflösung
    geometry_quality: 'detailed'  // Mehr Details in der Geometrie
  };

  const response = await fetch(`${TRIPO_BASE_URL}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(data.message);
  return data.data.task_id;
}

export async function createTripoRefineTask(apiKey: string, draftTaskId: string): Promise<string> {
  console.log('[Tripo] Starte High-End Refinement...');

  // Wir nutzen hier "refine_model" statt "texture_model" für maximale Geometrie-Qualität
  const body = {
    type: 'refine_model',
    draft_model_task_id: draftTaskId
  };

  const response = await fetch(`${TRIPO_BASE_URL}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(data.message);
  return data.data.task_id;
}

export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await response.json();
  return { ...data.data, task_id: data.data.task_id };
}

export function mapTripoStatus(tripoStatus: string): 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' {
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
