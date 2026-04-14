const TRIPO_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';

export interface TripoTask {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown';
  progress: number;
  input?: any;
  output?: {
    model?: string;
    pbr_model?: string;
    rendered_image?: string;
  };
}

export async function createTripoTask(
  apiKey: string,
  imagesBase64: string[]
): Promise<string> {
  console.log('[Tripo] Starte Multiview 3D Modell Erstellung. Bilder:', imagesBase64.length);

  // Tripo Multiview Erstellung (Step 1: Modell)
  const body = {
    type: 'multiview_to_model',
    model_version: 'v2.0-20240919', // P1 Modell
    files: imagesBase64.map((base64, index) => {
      // Entferne Data-URL Prefix falls vorhanden
      const content = base64.includes(',') ? base64.split(',')[1] : base64;
      return {
        name: `view_${index}.jpg`,
        content: content
      };
    })
  };

  const response = await fetch(`${TRIPO_BASE_URL}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tripo Erstellungsfehler: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.task_id;
}

export async function createTripoRefineTask(
  apiKey: string,
  draftTaskId: string
): Promise<string> {
  console.log('[Tripo] Starte Texturierung (Refine) für Task:', draftTaskId);

  const body = {
    type: 'texture_model',
    draft_task_id: draftTaskId
  };

  const response = await fetch(`${TRIPO_BASE_URL}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tripo Texturierungsfehler: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.task_id;
}

export async function getTripoTaskStatus(apiKey: string, taskId: string): Promise<TripoTask> {
  const response = await fetch(`${TRIPO_BASE_URL}/task/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Tripo Status Fehler: ${response.status}`);
  const data = await response.json();
  return data.data;
}

// Hilfsfunktion zur Konvertierung von Tripo Status zu App Status
export function mapTripoStatus(tripoStatus: TripoTask['status']): 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' {
  switch (tripoStatus) {
    case 'queued': return 'PENDING';
    case 'running': return 'IN_PROGRESS';
    case 'success': return 'SUCCEEDED';
    case 'failed': return 'FAILED';
    case 'cancelled': return 'EXPIRED';
    default: return 'FAILED';
  }
}
