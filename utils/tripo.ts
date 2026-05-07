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
 * Hilfsfunktion für robustes JSON-Parsing
 */
async function safeParseJson(response: Response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`API Fehler (${response.status}): Server antwortete nicht im JSON-Format. Details: ${text.substring(0, 100)}`);
  }
  return await response.json();
}

/**
 * Bild-Upload zu Tripo
 */
async function uploadToTripo(apiKey: string, uri: string): Promise<string> {
  const formData = new FormData();
  const filename = uri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  // @ts-ignore - FormData Handling für React Native
  formData.append('file', {
    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
    name: filename,
    type: type,
  });

  const response = await fetch(`${TRIPO_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Accept': 'application/json'
    },
    body: formData,
  });

  const data = await safeParseJson(response);
  if (data.code !== 0) throw new Error(`Upload fehlgeschlagen: ${data.message}`);
  return data.data.image_token || data.data.file_token;
}

/**
 * SCHRITT 1: Erstellung des Multiview-Modells (Draft/Basis)
 */
export async function createTripoTask(
  apiKey: string,
  imageUris: (string | null)[]
): Promise<string> {
  console.log('[Tripo] Starte Multiview Task - Optimiert für Web-Parität');

  const tokens = await Promise.all(imageUris.map(async (uri) => {
    if (!uri) return null;
    return await uploadToTripo(apiKey, uri);
  }));

  // WICHTIG: Die Reihenfolge sollte Front, Right, Back, Left entsprechen.
  const tripoOrder = [tokens[0], tokens[1], tokens[3], tokens[2]];
  const files = tripoOrder.map(token => token ? { type: 'jpg', file_token: token } : null).filter(f => f !== null);

  const body = {
    type: 'multiview_to_model',
    model_version: 'v3.1-20260211',
    files: files,
    // Parameter-Optimierung für Texturschärfe
    texture: true,
    pbr: true,
    texture_quality: 'ultra', // 'ultra' statt 'detailed' für maximale Auflösung
    geometry_quality: 'standard', // Draft sollte standard sein, Refine macht es später schön
    texture_alignment: 'original_image',
    orientation: 'align_image',
    // Verhindert das Einrechnen von Hintergründen, falls diese nicht perfekt weiß sind
    input_image_segmentation: true
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

/**
 * SCHRITT 2: Refinement & Texture Baking (Der "Web-Look" Schritt)
 * Auf der Website wird das Modell nach der Generierung oft verfeinert.
 */
export async function createTripoRefineTask(apiKey: string, draftTaskId: string): Promise<string> {
  console.log('[Tripo] Starte Refinement & Baking...');

  const body = {
    type: 'refine_model', // Erster Schritt zur Geometrie-Verbesserung
    draft_model_task_id: draftTaskId,
    texture: true,
    pbr: true,
    texture_quality: 'ultra',
    // Erhöht die Polygon-Dichte für scharfe Kanten, aber nicht zu extrem (Vermeidung von Noise)
    face_limit: 1000000
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

/**
 * Status abrufen
 */
export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
  });
  const data = await safeParseJson(response);
  return { ...data.data, task_id: data.data.task_id };
}

/**
 * Mapping für internes Status-Handling
 */
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

/**
 * Hilfsfunktion: Image zu Base64 (falls für andere Zwecke benötigt)
 */
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