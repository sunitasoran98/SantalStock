import { buildStaticFallbackZip, handleStaticFallback } from './staticFallback';

const TOKEN_KEY = 'santalstock_token_v1';
let useStaticFallback = false;

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function api<T = Record<string, unknown>>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  if (useStaticFallback) {
    return handleStaticFallback<T>(url, options, token);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
    const contentType = res.headers.get('content-type') || '';

    // When hosted as pure static files (e.g. Cloudflare Pages Direct Upload without Functions),
    // /api/* returns HTML (index.html) or non-JSON -> smoothly switch to static fallback engine
    if (!contentType.includes('application/json')) {
      useStaticFallback = true;
      return handleStaticFallback<T>(url, options, token);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    }
    return data as T;
  } catch (err) {
    if (err instanceof TypeError) {
      useStaticFallback = true;
      return handleStaticFallback<T>(url, options, token);
    }
    throw err;
  }
}

export async function downloadSourceZip(): Promise<{ filename: string; sizeBytes: number }> {
  const token = getToken();
  let blob: Blob;
  let filename = `santalstock-source-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}.zip`;

  if (useStaticFallback) {
    const built = await buildStaticFallbackZip();
    blob = built.blob;
    filename = built.filename;
  } else {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch('/api/admin/source-zip', {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/zip')) {
      const disp = res.headers.get('content-disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) filename = match[1];
      blob = await res.blob();
    } else if (contentType.includes('application/json')) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `ZIP download failed (${res.status})`);
    } else {
      useStaticFallback = true;
      const built = await buildStaticFallbackZip();
      blob = built.blob;
      filename = built.filename;
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  return { filename, sizeBytes: blob.size };
}
