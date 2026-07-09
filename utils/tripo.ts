import { Platform } from 'react-native';

const TRIPO_BASE_URL = 'https://openapi.tripo3d.ai/v3';

export interface TripoTask {
  task_id: string;
  type: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown' | 'banned' | 'expired';
  progress: number;
  output?: {
    model?: string;
    model_url?: string;
    pbr_model?: string;
    rendered_image?: string;
    rendered_image_url?: string;
    [key: string]: any;
  };
  input?: any;
  [key: string]: any;
}

export class TripoApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'TripoApiError';
  }
}

async function safeParseJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  const status = response.status;

  // Handle server errors (502, 503, 504)
  if (status >= 502 && status <= 504) {
    throw new TripoApiError(
      `Tripo-Server vorübergehend nicht verfügbar (${status}). Bitte später erneut versuchen.`,
      status,
      true // Retryable
    );
  }

  // Handle rate limiting
  if (status === 429) {
    throw new TripoApiError(
      'Zu viele Anfragen. Bitte kurz warten.',
      status,
      true // Retryable
    );
  }

  // Handle auth errors
  if (status === 401 || status === 403) {
    throw new TripoApiError(
      'Ungültiger API-Key oder keine Berechtigung.',
      status,
      false
    );
  }

  // Check for JSON response
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    // Check if it's an HTML error page (common for cloud providers)
    if (text.toLowerCase().includes('<!doctype') || text.toLowerCase().includes('<html')) {
      throw new TripoApiError(
        `Server-Fehler (${status}): Dienst kurzzeitig nicht verfügbar.`,
        status,
        true
      );
    }
    throw new TripoApiError(
      `Unerwartete Server-Antwort (${status}): ${text.substring(0, 100)}`,
      status,
      false
    );
  }

  const data = await response.json();

  // Check for API-level errors from Tripo
  if (data.code !== 0) {
    throw new TripoApiError(
      data.message || `API-Fehler (${data.code})`,
      status,
      data.code === 429
    );
  }

  return data;
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

  const response = await fetch(`${TRIPO_BASE_URL}/files`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
    body: formData,
  });

  const data = await safeParseJson(response);
  return data.data.file_token;
}

/**
 * Erstellt den Draft und gibt zusätzlich die Tokens zurück.
 */
export async function createTripoTask(
  apiKey: string,
  imageUris: (string | null)[],
  quality: 'fast' | 'detailed' | 'extreme' = 'detailed'
): Promise<{ taskId: string; tokens: string[] }> {
  const validUris = imageUris.filter((u): u is string => u !== null);
  const isSingleView = validUris.length === 1;

  console.log(`[Tripo] Starte ${isSingleView ? 'Singleview' : 'Multiview'} Task (V3.1)`);

  const tokens = await Promise.all(imageUris.map(async (uri) => {
    if (!uri) return null;
    return await uploadToTripo(apiKey, uri);
  }));

  const validTokens = tokens.filter((t): t is string => t !== null);

  let endpoint: string;
  let body: any = {
    model: 'v3.1-20260211',
    parameters: {
      texture: true,
      pbr: true,
      texture_quality: quality === 'fast' ? 'standard' : quality === 'detailed' ? 'detailed' : 'extreme',
      face_limit: quality === 'fast' ? 200000 : quality === 'detailed' ? 750000 : 1800000,
      geometry_quality: 'standard',
      texture_alignment: 'original_image',
      orientation: 'align_image',
      orthographic_projection: false
    }
  };

  if (isSingleView) {
    endpoint = `${TRIPO_BASE_URL}/generation/image-to-model`;
    body.file = {
      type: 'jpg',
      file_token: validTokens[0]
    };
  } else {
    endpoint = `${TRIPO_BASE_URL}/generation/multiview-to-model`;
    // Tripo Multiview Reihenfolge: Front, Left, Back, Right (0, 1, 3, 2)
    const tripoOrder = [tokens[0], tokens[1], tokens[3], tokens[2]];
    body.files = tripoOrder.map(token => token ? { type: 'jpg', file_token: token } : {});
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await safeParseJson(response);

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
  quality: 'fast' | 'detailed' | 'extreme' = 'detailed'
): Promise<string> {
  console.log('[Tripo] Starte Refine Task (v3.0) mit Bild-Referenzen');

  const body = {
    model: 'v3.0-20250812',
    original_model_task_id: draftTaskId,
    texture_prompt: {
      images: imageTokens.map(token => ({
        file: {
          type: 'jpg',
          file_token: token
        }
      }))
    },
    parameters: {
      texture: true,
      pbr: true,
      texture_quality: quality === 'fast' ? 'standard' : quality === 'detailed' ? 'detailed' : 'extreme',
      texture_alignment: 'original_image',
      bake: true
    }
  };

  const response = await fetch(`${TRIPO_BASE_URL}/models/texture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await safeParseJson(response);
  return data.data.task_id;
}

export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/tasks/${taskId}`, {
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
