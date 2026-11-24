/* Shared duplicate matching (used by the Cloudflare function and the static fallback). */
export interface FingerprintFields {
  sha256?: string;
  phash?: string;
  dhash?: string;
  phashFlip?: string;
  dhashFlip?: string;
}

export interface DupHit {
  id: string;
  kind: 'exact' | 'similar';
  score: number; // 0-100 similarity
}

const HEX = /^[0-9a-f]{16}$/;

export function hamming(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 64;
  let d = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export function cleanFingerprint(b: Record<string, unknown>): FingerprintFields {
  const out: FingerprintFields = {};
  if (typeof b.sha256 === 'string' && /^[0-9a-f]{64}$/.test(b.sha256)) out.sha256 = b.sha256;
  for (const k of ['phash', 'dhash', 'phashFlip', 'dhashFlip'] as const) {
    const v = b[k];
    if (typeof v === 'string' && HEX.test(v)) out[k] = v;
  }
  return out;
}

// pHash distance <= 10 or dHash <= 8 (out of 64 bits) counts as an edited copy.
export const PHASH_LIMIT = 10;
export const DHASH_LIMIT = 8;

export function findDuplicates(fp: FingerprintFields, assets: (FingerprintFields & { id: string; status?: string })[], skipId?: string): DupHit[] {
  const hits: DupHit[] = [];
  for (const a of assets) {
    if (a.id === skipId) continue;
    if (fp.sha256 && a.sha256 && fp.sha256 === a.sha256) {
      hits.push({ id: a.id, kind: 'exact', score: 100 });
      continue;
    }
    if (!fp.phash || !a.phash) continue;
    const pDirect = hamming(fp.phash, a.phash);
    const dDirect = a.dhash && fp.dhash ? hamming(fp.dhash, a.dhash) : 64;
    const p = Math.min(pDirect, fp.phashFlip ? hamming(fp.phashFlip, a.phash) : 64);
    const d = Math.min(dDirect, a.dhash && fp.dhashFlip ? hamming(fp.dhashFlip, a.dhash) : 64);
    if (p <= PHASH_LIMIT || d <= DHASH_LIMIT) {
      // Re-saved copy (same pixels, different file) = exact; mirrored or edited = similar, sent to admin.
      const exact = pDirect === 0 && dDirect === 0;
      const dist = d < 64 ? (p + d) / 2 : p;
      hits.push({ id: a.id, kind: exact ? 'exact' : 'similar', score: exact ? 100 : Math.min(99, Math.round((1 - dist / 64) * 100)) });
    }
  }
  return hits.sort((x, y) => y.score - x.score).slice(0, 5);
}

export function reverseSearchLinks(absImageUrl: string): { name: string; url: string }[] {
  const u = encodeURIComponent(absImageUrl);
  return [
    { name: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${u}` },
    { name: 'TinEye', url: `https://tineye.com/search?url=${u}` },
    { name: 'Bing', url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${u}` },
    { name: 'Yandex', url: `https://yandex.com/images/search?rpt=imageview&url=${u}` },
  ];
}
