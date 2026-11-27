import type { Asset } from '../types';

/** Short Hinglish line for the internet (Google Lens) result returned after upload. */
export function webResultText(web: Asset['web'] | undefined): string {
  if (!web) return '· 🌐 Internet jaanch chal rahi hai, result Admin me dikhega.';
  if (web.error) return `· ❔ Internet jaanch nahi hui (${web.error}).`;
  if (web.count) {
    const src = web.links.slice(0, 2).map((l) => l.source || l.title).join(', ');
    return `· ⚠️ Ye photo ${web.count} website par mili${src ? ` (${src})` : ''}. Shayad kisi aur ki hai, jaanch karein.`;
  }
  return '· ✅ Internet par kahin aur nahi mili.';
}
