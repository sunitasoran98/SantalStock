/* Browser-side image fingerprints for duplicate detection.
 * Layer 1 (exact): SHA-256 of the original file bytes.
 * Layer 2 (edited): perceptual hashes (pHash + dHash), plus mirrored versions,
 *   so resized, recompressed, colour-filtered, lightly cropped or flipped copies still match. */
export interface ImageFingerprint {
  sha256: string;
  phash: string;
  dhash: string;
  phashFlip: string;
  dhashFlip: string;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function grayPixels(img: CanvasImageSource, w: number, h: number, flip: boolean): Float64Array {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  if (flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  return out;
}

function bitsToHex(bits: number[]): string {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
  return hex;
}

function dHash(img: CanvasImageSource, flip: boolean): string {
  const p = grayPixels(img, 9, 8, flip);
  const bits: number[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push(p[y * 9 + x] > p[y * 9 + x + 1] ? 1 : 0);
  return bitsToHex(bits);
}

const N = 32;
const COS: number[][] = Array.from({ length: 8 }, (_, u) => Array.from({ length: N }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))));

function pHash(img: CanvasImageSource, flip: boolean): string {
  const p = grayPixels(img, N, N, flip);
  const dct: number[] = [];
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let s = 0;
      for (let y = 0; y < N; y++) {
        const cy = COS[u][y];
        for (let x = 0; x < N; x++) s += p[y * N + x] * cy * COS[v][x];
      }
      dct.push(s);
    }
  }
  const ac = dct.slice(1);
  const median = [...ac].sort((a, b) => a - b)[Math.floor(ac.length / 2)];
  return bitsToHex(dct.map((v) => (v > median ? 1 : 0)));
}

export async function fingerprintFile(file: File): Promise<ImageFingerprint> {
  const buf = await file.arrayBuffer();
  const sha256 = await sha256Hex(buf);
  const bmp = await createImageBitmap(new Blob([buf], { type: file.type || 'image/jpeg' }));
  try {
    return { sha256, phash: pHash(bmp, false), dhash: dHash(bmp, false), phashFlip: pHash(bmp, true), dhashFlip: dHash(bmp, true) };
  } finally {
    bmp.close();
  }
}

/** Same hashes for an image already on the site (used to back-fill old photos). */
export async function fingerprintBlob(blob: Blob): Promise<Omit<ImageFingerprint, 'sha256'>> {
  const bmp = await createImageBitmap(blob);
  try {
    return { phash: pHash(bmp, false), dhash: dHash(bmp, false), phashFlip: pHash(bmp, true), dhashFlip: dHash(bmp, true) };
  } finally {
    bmp.close();
  }
}
