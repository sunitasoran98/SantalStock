import type { Asset, GitHubCommitInfo, GitHubSyncConfig, SiteConfig } from '../types';

export interface LiveSnapshotPayload {
  version: number;
  updatedAt: string;
  siteConfig: SiteConfig;
  assets: Asset[];
  deletedSeed: string[];
}

const OWNER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const REPO_RE = /^[a-zA-Z0-9._-]{1,100}$/;
const BRANCH_RE = /^[a-zA-Z0-9._/-]{1,100}$/;

export function validateGitHubRepoConfig(
  ownerRaw: string,
  repoRaw: string,
  branchRaw: string
): { ok: true; owner: string; repo: string; branch: string } | { ok: false; error: string } {
  const owner = ownerRaw.trim();
  const repo = repoRaw.trim();
  const branch = (branchRaw || 'main').trim();

  if (!OWNER_RE.test(owner)) {
    return { ok: false, error: 'Invalid GitHub owner/username. Use letters, numbers, and hyphens only.' };
  }
  if (!REPO_RE.test(repo) || repo === '.' || repo === '..' || repo.includes('..')) {
    return { ok: false, error: 'Invalid GitHub repository name.' };
  }
  if (!BRANCH_RE.test(branch) || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/')) {
    return { ok: false, error: 'Invalid GitHub branch name (e.g. main).' };
  }
  return { ok: true, owner, repo, branch };
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function buildLiveSnapshotPayload(
  siteConfig: SiteConfig,
  assets: Asset[],
  deletedSeed: string[]
): LiveSnapshotPayload {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    siteConfig,
    assets,
    deletedSeed,
  };
}

export const CLOUDFLARE_WORKFLOW_YML = `name: Auto-Deploy SantalStock to Cloudflare Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - name: Checkout latest source
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm install

      - name: Build production bundle
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=santalstock
`;

export const WRANGLER_TOML_CONTENT = `name = "santalstock"
compatibility_date = "2026-01-01"
pages_build_output_dir = "dist"
`;

export const HEADERS_CONTENT = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

async function githubUpsertFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  contentText: string,
  message: string
): Promise<{ sha: string; htmlUrl: string }> {
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'SantalStock-AutoUpdater/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  let existingSha: string | undefined;
  const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (getRes.ok) {
    const existing = (await getRes.json()) as { sha?: string };
    existingSha = existing.sha;
  } else if (getRes.status !== 404) {
    const errBody = (await getRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message || `GitHub lookup failed (${getRes.status})`);
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      content: utf8ToBase64(contentText),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });

  if (!putRes.ok) {
    const errBody = (await putRes.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message || `GitHub push failed (${putRes.status})`);
  }

  const data = (await putRes.json()) as { commit?: { sha?: string; html_url?: string } };
  return {
    sha: data.commit?.sha || '',
    htmlUrl: data.commit?.html_url || `https://github.com/${owner}/${repo}/commits/${branch}`,
  };
}

export async function pushLiveSnapshotToGitHub(
  token: string,
  config: Pick<GitHubSyncConfig, 'owner' | 'repo' | 'branch'>,
  snapshot: LiveSnapshotPayload,
  reason = 'Admin live update',
  includeWorkflow = false
): Promise<{ sha: string; htmlUrl: string; syncedAt: string }> {
  const check = validateGitHubRepoConfig(config.owner, config.repo, config.branch);
  if (!check.ok) throw new Error(check.error);

  const snapshotJson = JSON.stringify(snapshot, null, 2) + '\n';
  const result = await githubUpsertFile(
    token,
    check.owner,
    check.repo,
    check.branch,
    'src/data/liveSnapshot.json',
    snapshotJson,
    `chore(santalstock): ${reason} (${snapshot.updatedAt.slice(0, 16).replace('T', ' ')} UTC)`
  );

  if (includeWorkflow) {
    try {
      await githubUpsertFile(
        token,
        check.owner,
        check.repo,
        check.branch,
        '.github/workflows/cloudflare-pages.yml',
        CLOUDFLARE_WORKFLOW_YML,
        'ci(cloudflare): ensure Cloudflare Pages auto-deploy workflow'
      );
    } catch {
      // Some fine-grained PATs omit workflows permission; keep primary snapshot sync successful
    }
  }

  return {
    sha: result.sha,
    htmlUrl: result.htmlUrl,
    syncedAt: new Date().toISOString(),
  };
}

export async function fetchLatestGitHubCommit(
  config: Pick<GitHubSyncConfig, 'owner' | 'repo' | 'branch'>,
  token?: string
): Promise<GitHubCommitInfo> {
  const check = validateGitHubRepoConfig(config.owner, config.repo, config.branch);
  if (!check.ok) throw new Error(check.error);

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(check.owner)}/${encodeURIComponent(check.repo)}/commits/${encodeURIComponent(check.branch)}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'SantalStock-AutoUpdater/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl, { headers });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message || `Could not read GitHub repo (${res.status})`);
  }

  const data = (await res.json()) as {
    sha?: string;
    html_url?: string;
    commit?: {
      message?: string;
      author?: { name?: string; date?: string };
    };
  };
  const sha = data.sha || '';
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: (data.commit?.message || '').split('\n')[0],
    author: data.commit?.author?.name || check.owner,
    date: data.commit?.author?.date || '',
    htmlUrl: data.html_url || `https://github.com/${check.owner}/${check.repo}`,
    archiveZipUrl: `https://github.com/${check.owner}/${check.repo}/archive/refs/heads/${encodeURIComponent(check.branch)}.zip`,
  };
}
