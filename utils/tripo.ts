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
 * Lädt eine Bilddatei über Multipart/Form-Data hoch, wie in der Tripo V2 Spec gefordert.
 */
async function uploadToTripo(apiKey: string, uri: string): Promise<string> {
  const formData = new FormData();

  // Extrahiere Dateiname und Typ aus der URI oder nutze Defaults
  const filename = uri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  // @ts-ignore
  formData.append('file', {
    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
    name: filename,
    type: type,
  });

  console.log('[Tripo] Uploading:', filename);

  const response = await fetch(`${TRIPO_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      // 'Content-Type' darf NICHT gesetzt werden bei FormData, fetch macht das automatisch inkl. boundary
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    console.error('[Tripo] Upload Fehler:', data);
    throw new Error(`Upload fehlgeschlagen: ${data.message || 'Unbekannter Fehler'}`);
  }

  return data.data.image_token || data.data.file_token;
}

import { Platform } from 'react-native';

export async function createTripoTask(
  apiKey: string,
  imageUris: (string | null)[]
): Promise<string> {
  console.log('[Tripo] Starte Multiview Task (P1). Uploading images...');

  // 1. Alle verfügbaren Bilder hochladen
  const tokens = await Promise.all(imageUris.map(async (uri) => {
    if (!uri) return null;
    return await uploadToTripo(apiKey, uri);
  }));

  // 2. Mapping auf Tripo-Reihenfolge: [Front, Left, Back, Right]
  // UI Indices: 0:Vorne, 1:Links, 2:Rechts, 3:Hinten
  const tripoOrder = [
    tokens[0], // Front
    tokens[1], // Left
    tokens[3], // Back (UI Index 3)
    tokens[2]  // Right (UI Index 2)
  ];

  // 3. Files Array aufbauen (exakt 4 Items)
  const files = tripoOrder.map(token => {
    if (!token) return {};
    return {
      type: 'jpg',
      file_token: token
    };
  });

  const body = {
    type: 'multiview_to_model',
    model_version: 'P1-20260311',
    files: files,
    face_limit: 4000,
    texture: true,
    pbr: true
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

  if (!response.ok || data.code !== 0) {
    console.error('[Tripo] Task Fehler:', data);
    throw new Error(`Tripo Fehler ${data.code}: ${data.message}`);
  }

  return data.data.task_id;
}

export async function createTripoRefineTask(
  apiKey: string,
  draftTaskId: string
): Promise<string> {
  console.log('[Tripo] Starte Texture Refinement...');

  // Laut P1 Doku wird für Refinement "texture_model" mit "original_model_task_id" genutzt
  const body = {
    type: 'texture_model',
    original_model_task_id: draftTaskId,
    texture: true,
    pbr: true
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
  if (!response.ok || data.code !== 0) {
    throw new Error(`Refine Fehler: ${data.message}`);
  }

  return data.data.task_id;
}

export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(`Status Fehler: ${data.message}`);
  }

  // Sicherstellen, dass task_id vorhanden ist
  return { ...data.data, task_id: data.data.task_id };
}

export function mapTripoStatus(tripoStatus: string): 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' {
  const map: Record<string, 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED'> = {
    queued: 'PENDING',
    running: 'IN_PROGRESS',
    success: 'SUCCEEDED',
    failed: 'FAILED',
    cancelled: 'EXPIRED',
    expired: 'EXPIRED',
    banned: 'FAILED',
    unknown: 'FAILED'
  };
  return map[tripoStatus] || 'FAILED';
}

export async function imageUriToBase64DataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Fehler'));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
