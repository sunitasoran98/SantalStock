import { useEffect, useRef } from 'react';
import { api, getToken } from './api';
import { fingerprintBlob } from './imageFingerprint';
import type { Asset } from '../types';

/** Admin only: old uploaded photos without fingerprints get them once, so duplicate check covers them too. */
export function useFingerprintBackfill(isAdmin: boolean, assets: Asset[], onDone: () => void) {
  const running = useRef(false);
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!isAdmin || running.current) return;
    const todo = assets.filter((a) => !a.phash && !tried.current.has(a.id) && (a.fullUrl || a.prevUrl || '').startsWith('/api/img/')).slice(0, 25);
    if (!todo.length) return;
    running.current = true;
    todo.forEach((a) => tried.current.add(a.id));
    (async () => {
      const items: Record<string, string>[] = [];
      const tok = getToken();
      for (const a of todo) {
        try {
          const res = await fetch(a.fullUrl || a.prevUrl || '', { credentials: 'include', headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
          if (!res.ok) continue;
          items.push({ id: a.id, ...(await fingerprintBlob(await res.blob())) });
        } catch {
          // skip this one, try again next visit
        }
      }
      if (items.length) {
        await api('/api/assets/fingerprints', { method: 'POST', body: JSON.stringify({ items }) }).catch(() => undefined);
        onDone();
      }
    })().finally(() => {
      running.current = false;
    });
  }, [isAdmin, assets, onDone]);
}
