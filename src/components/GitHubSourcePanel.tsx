import React, { useEffect, useState } from 'react';
import {
  Download,
  GitBranch,
  RefreshCw,
  CheckCircle2,
  CloudUpload,
  FileArchive,
  ExternalLink,
  AlertCircle,
  Save,
} from 'lucide-react';
import { api, downloadSourceZip } from '../lib/api';
import type { Asset, GitHubCommitInfo, GitHubSyncConfig, SiteConfig } from '../types';

interface GitHubSourcePanelProps {
  siteConfig: SiteConfig;
  assets: Asset[];
  money: (n: number) => string;
  toast: (msg: string) => void;
}

export function GitHubSourcePanel({ siteConfig, assets, money, toast }: GitHubSourcePanelProps) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [autoSync, setAutoSync] = useState(false);
  const [includeWorkflow, setIncludeWorkflow] = useState(true);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [fullSourceZipAvailable, setFullSourceZipAvailable] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState('');
  const [lastCommitSha, setLastCommitSha] = useState('');
  const [lastCommitUrl, setLastCommitUrl] = useState('');
  const [lastError, setLastError] = useState('');

  const [latestCommit, setLatestCommit] = useState<GitHubCommitInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checkingLatest, setCheckingLatest] = useState(false);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const res = await api<{
        tokenConfigured: boolean;
        fullSourceZipAvailable: boolean;
        config: GitHubSyncConfig;
      }>('/api/admin/github/status');
      setTokenConfigured(Boolean(res.tokenConfigured));
      setFullSourceZipAvailable(Boolean(res.fullSourceZipAvailable));
      setOwner(res.config?.owner || '');
      setRepo(res.config?.repo || '');
      setBranch(res.config?.branch || 'main');
      setAutoSync(Boolean(res.config?.autoSync));
      setLastSyncedAt(res.config?.lastSyncedAt || '');
      setLastCommitSha(res.config?.lastCommitSha || '');
      setLastCommitUrl(res.config?.lastCommitUrl || '');
      setLastError(res.config?.lastError || '');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDownloadZip() {
    setDownloadingZip(true);
    try {
      const res = await downloadSourceZip();
      const kb = Math.max(1, Math.round(res.sizeBytes / 1024));
      toast(`Downloaded ${res.filename} (${kb} KB) ✓`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setDownloadingZip(false);
    }
  }

  async function handleDownloadSnapshotJson() {
    try {
      const data = await api<{ siteConfig: SiteConfig; assets: Asset[]; deletedSeed: string[] }>('/api/admin/export');
      const snapshot = {
        version: 1,
        updatedAt: new Date().toISOString(),
        siteConfig: data.siteConfig,
        assets: data.assets,
        deletedSeed: data.deletedSeed,
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'liveSnapshot.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('liveSnapshot.json downloaded ✓');
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await api<{ config: GitHubSyncConfig; tokenConfigured: boolean }>('/api/admin/github/config', {
        method: 'PUT',
        body: JSON.stringify({ owner, repo, branch, autoSync }),
      });
      setOwner(res.config.owner);
      setRepo(res.config.repo);
      setBranch(res.config.branch);
      setAutoSync(res.config.autoSync);
      setTokenConfigured(res.tokenConfigured);
      setLastError('');
      toast('GitHub repository settings saved ✓');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handlePushToGitHub() {
    setSyncing(true);
    try {
      const res = await api<{
        ok: boolean;
        result: { sha: string; htmlUrl: string; syncedAt: string };
        config: GitHubSyncConfig;
      }>('/api/admin/github/sync', {
        method: 'POST',
        body: JSON.stringify({ includeWorkflow }),
      });
      setLastSyncedAt(res.config.lastSyncedAt || res.result.syncedAt);
      setLastCommitSha(res.config.lastCommitSha || res.result.sha);
      setLastCommitUrl(res.config.lastCommitUrl || res.result.htmlUrl);
      setLastError('');
      toast('Live update pushed to GitHub ✓ Cloudflare auto-deploy triggered!');
    } catch (err) {
      const msg = (err as Error).message;
      setLastError(msg);
      toast(msg);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCheckLatest() {
    setCheckingLatest(true);
    try {
      const res = await api<{ commit: GitHubCommitInfo }>('/api/admin/github/latest');
      setLatestCommit(res.commit);
      toast(`Latest GitHub commit: ${res.commit.shortSha}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setCheckingLatest(false);
    }
  }

  const repoArchiveUrl =
    owner && repo
      ? `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${encodeURIComponent(branch || 'main')}.zip`
      : '';

  return (
    <div className="space-y-5">
      {/* TOP CARD: AUTO-UPDATED SOURCE ZIP DOWNLOAD */}
      <div className="bg-white border border-[#d9dbe1] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#d6262f]">
              <FileArchive className="w-4 h-4" />
              Auto-Updated Source ZIP System
            </div>
            <h2 className="dm text-2xl sm:text-3xl text-[#011f43] m-0">
              GitHub + Auto-Update Source ZIP डाउनलोड करें
            </h2>
            <p className="text-sm text-[#4a5468] m-0 leading-relaxed">
              {fullSourceZipAvailable
                ? 'Is button par click karne par poora SantalStock source code ZIP ban kar download hota hai — jisme aapke sabhi live Admin Mode edits (colors, minimum prices, sections, FAQs aur uploaded photos) automatically src/data/liveSnapshot.json + Cloudflare Pages workflow ke saath update hokar pack hote hain.'
                : 'Cloudflare edge mode mein yeh button aapke sabhi live Admin Mode edits (colors, prices, sections, photos) ka Auto-Update ZIP (src/data/liveSnapshot.json + Cloudflare workflow + wrangler.toml) turant generate karta hai. Poora repo ZIP neeche GitHub button se 1-click mein download karein.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              disabled={downloadingZip}
              onClick={handleDownloadZip}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#d6262f] hover:bg-[#b81d25] text-white font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {downloadingZip
                ? 'Building Live ZIP...'
                : fullSourceZipAvailable
                ? 'Auto-Updated Source ZIP डाउनलोड करें'
                : 'Live Update ZIP डाउनलोड करें'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadSnapshotJson}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#d9dbe1] bg-[#f8faff] hover:border-[#011f43] text-[#011f43] text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> liveSnapshot.json
              </button>

              {repoArchiveUrl && (
                <a
                  href={repoArchiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#011f43] bg-[#011f43] text-white no-underline text-xs font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> GitHub Repo ZIP
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Snapshot summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#e7ebf3] text-xs">
          <div className="bg-[#f8faff] border border-[#e3e8f2] rounded-xl p-3">
            <span className="text-[#5c6170] block">Packed Photos</span>
            <b className="text-base text-[#011f43] tabular-nums">{assets.length} assets</b>
          </div>
          <div className="bg-[#f8faff] border border-[#e3e8f2] rounded-xl p-3">
            <span className="text-[#5c6170] block">Min Prices Baked In</span>
            <b className="text-base text-[#011f43] tabular-nums">
              ED {money(siteConfig.pricing.matrix.ed.S)} · RF {money(siteConfig.pricing.matrix.std.S)}
            </b>
          </div>
          <div className="bg-[#f8faff] border border-[#e3e8f2] rounded-xl p-3">
            <span className="text-[#5c6170] block">Custom Sections</span>
            <b className="text-base text-[#011f43] tabular-nums">{siteConfig.customSections.length} live</b>
          </div>
          <div className="bg-[#f8faff] border border-[#e3e8f2] rounded-xl p-3">
            <span className="text-[#5c6170] block">Cloudflare Ready</span>
            <b className="text-base text-emerald-700">Functions + KV + CI</b>
          </div>
        </div>
      </div>

      {/* BOTTOM GRID: GITHUB AUTO-SYNC + CLOUDFLARE AUTO-DEPLOY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={handleSaveConfig} className="bg-white border border-[#d9dbe1] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="m-0 text-lg font-bold text-[#011f43] inline-flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-[#2563eb]" />
              GitHub Repository & Auto-Update
            </h3>
            {!loadingStatus && (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                  tokenConfigured ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {tokenConfigured ? 'Server GITHUB_TOKEN Ready' : 'GITHUB_TOKEN Not Set'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#011f43] mb-1">GitHub Username / Owner</label>
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g. sunitasoren"
                className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#011f43] mb-1">Repository Name</label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g. santalstock"
                className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#011f43] mb-1">Branch</label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 border border-[#d9dbe1] rounded-lg text-sm"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#dbe3ef] bg-[#f8faff] cursor-pointer">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-[#24324f]">
              <b className="block text-sm text-[#011f43]">Auto-Update GitHub on every Admin Save</b>
              Jab bhi aap Admin Mode se color, price, section ya photo save karein, updated{' '}
              <code>src/data/liveSnapshot.json</code> automatically GitHub par commit ho jayega (jisse Cloudflare Pages auto-rebuild ho jata hai).
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#011f43] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {savingConfig ? 'Saving...' : 'Save Repo Settings'}
            </button>

            <button
              type="button"
              disabled={checkingLatest || !owner || !repo}
              onClick={handleCheckLatest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#d9dbe1] bg-white text-[#011f43] text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingLatest ? 'animate-spin' : ''}`} />
              Check Latest GitHub Commit
            </button>
          </div>
        </form>

        {/* PUSH NOW + LIVE SYNC STATUS */}
        <div className="bg-white border border-[#d9dbe1] rounded-2xl p-5 space-y-4">
          <h3 className="m-0 text-lg font-bold text-[#011f43] inline-flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-[#0f766e]" />
            Push Update & Auto-Deploy Status
          </h3>

          <label className="flex items-center gap-2 text-xs text-[#33405c] cursor-pointer">
            <input
              type="checkbox"
              checked={includeWorkflow}
              onChange={(e) => setIncludeWorkflow(e.target.checked)}
            />
            Also sync <code>.github/workflows/cloudflare-pages.yml</code> (auto-deploy workflow)
          </label>

          <button
            type="button"
            disabled={syncing || !owner || !repo}
            onClick={handlePushToGitHub}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0f766e] hover:bg-[#0d625b] text-white font-bold text-sm cursor-pointer disabled:opacity-50"
          >
            <CloudUpload className="w-4 h-4" />
            {syncing ? 'Pushing Live Update to GitHub...' : 'Push Live Update to GitHub Now'}
          </button>

          {lastSyncedAt && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-1">
              <div className="font-bold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Last Auto-Sync: {new Date(lastSyncedAt).toLocaleString('en-IN')}
              </div>
              {lastCommitSha && (
                <div>
                  Commit:{' '}
                  {lastCommitUrl ? (
                    <a href={lastCommitUrl} target="_blank" rel="noopener noreferrer" className="font-mono underline font-bold text-emerald-800">
                      {lastCommitSha.slice(0, 7)}
                    </a>
                  ) : (
                    <code className="font-mono">{lastCommitSha.slice(0, 7)}</code>
                  )}
                </div>
              )}
            </div>
          )}

          {lastError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}

          {latestCommit && (
            <div className="rounded-xl border border-[#dbe3ef] bg-[#f8faff] p-3 text-xs space-y-1">
              <div className="font-bold text-[#011f43]">Latest Commit on GitHub ({branch})</div>
              <div className="text-[#33405c]">
                <code className="font-mono font-bold text-[#2563eb]">{latestCommit.shortSha}</code> — {latestCommit.message}
              </div>
              <div className="text-[#5c6170]">
                by {latestCommit.author} · {latestCommit.date ? new Date(latestCommit.date).toLocaleString('en-IN') : ''}
              </div>
              <div className="pt-1 flex gap-3">
                <a href={latestCommit.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-[#2563eb] font-bold hover:underline">
                  View on GitHub →
                </a>
                <a href={latestCommit.archiveZipUrl} target="_blank" rel="noopener noreferrer" className="text-[#d6262f] font-bold hover:underline">
                  Download Repo ZIP →
                </a>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[#f6f7fb] border border-[#e3e7f0] p-3.5 text-xs text-[#4a5468] space-y-1.5">
            <div className="font-bold text-[#011f43]">Security Note — Server Secret Setup</div>
            <p className="m-0">
              For safety, GitHub Personal Access Tokens are never entered in browser forms. To enable direct 1-click GitHub Push & Auto-Sync, add{' '}
              <code className="text-[#011f43]">GITHUB_TOKEN</code> (Fine-Grained PAT with <b>Contents: Read & Write</b>) in your server Secrets or{' '}
              <b>Cloudflare Pages → Settings → Variables and Secrets</b>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
