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

async function safeParseJson(response: Response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`API Fehler (${response.status}): Server antwortete nicht im JSON-Format.`);
  }
  return await response.json();
}

/**
 * Upload eines Bildes und Erhalt eines Tokens
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
    headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
    body: formData,
  });

  const data = await safeParseJson(response);
  if (data.code !== 0) throw new Error(`Upload Fehler: ${data.message}`);
  return data.data.image_token || data.data.file_token;
}

/**
 * SCHRITT 1: Basis Modell Erstellung
 * KORREKTUR: Das 'files' Array darf nur existierende Token enthalten.
 */
export async function createTripoTask(
  apiKey: string,
  imageUris: (string | null)[]
): Promise<string> {
  console.log('[Tripo] Starte Multiview Task...');

  const tokens = await Promise.all(imageUris.map(async (uri) => {
    if (!uri) return null;
    try {
      return await uploadToTripo(apiKey, uri);
    } catch (e) {
      console.error("Upload fehlgeschlagen für URI:", uri, e);
      return null;
    }
  }));

  // WICHTIG: Nur valide Token ins Array aufnehmen.
  // Tripo V3 erwartet bei Multiview ein Array von Objekten.
  const files = tokens
    .filter((token): token is string => token !== null)
    .map(token => ({
      type: 'jpg',
      file_token: token
    }));

  if (files.length === 0) {
    throw new Error("Keine validen Bilder für den Task vorhanden.");
  }

  const body = {
    type: 'multiview_to_model',
    model_version: 'v3.1-20260211',
    files: files, // Hier dürfen keine leeren {} drin sein!
    // Stabile Parameter für V3.1
    texture: true,
    pbr: true,
    texture_quality: 'detailed', // 'ultra' oft nur in Refine erlaubt
    geometry_quality: 'standard',
    texture_alignment: 'original_image',
    // Dieser Parameter ist oft der Grund für "invalid", falls nicht unterstützt:
    // Wir lassen ihn weg oder nutzen den Standard:
    orientation: 'align_image'
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
  if (data.code !== 0) {
    console.error("[Tripo] API Error Detail:", data);
    throw new Error(`Task Erstellung fehlgeschlagen: ${data.message}`);
  }
  return data.data.task_id;
}

/**
 * SCHRITT 2: Verfeinerung
 * KORREKTUR: Nutzt 'refine_model' statt 'texture_model' für Web-Qualität
 */
export async function createTripoRefineTask(apiKey: string, draftTaskId: string): Promise<string> {
  const body = {
    type: 'refine_model',
    draft_model_task_id: draftTaskId, // WICHTIGER KEY NAME
    texture: true,
    pbr: true
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
  if (data.code !== 0) throw new Error(`Refine Fehler: ${data.message}`);
  return data.data.task_id;
}

export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
  });
  const data = await safeParseJson(response);
  return { ...data.data, task_id: data.data.task_id };
}

export function mapTripoStatus(tripoStatus: string): string {
  const map: Record<string, string> = {
    queued: 'PENDING',
    running: 'IN_PROGRESS',
    success: 'SUCCEEDED',
    failed: 'FAILED',
    cancelled: 'EXPIRED',
    expired: 'EXPIRED'
  };
  return map[tripoStatus] || 'FAILED';
}