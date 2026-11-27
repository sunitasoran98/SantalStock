import { DEFAULT_SITE_CONFIG, SEED_ASSETS } from '../../src/data/defaults';
import {
  buildLiveSnapshotPayload,
  CLOUDFLARE_WORKFLOW_YML,
  fetchLatestGitHubCommit,
  HEADERS_CONTENT,
  pushLiveSnapshotToGitHub,
  validateGitHubRepoConfig,
} from '../../src/lib/githubSync';
import { buildZip } from '../../src/lib/zipBuilder';
import { cleanFingerprint, findDuplicates } from '../../src/lib/dupMatch';
import type { Asset, ContactMessage, GitHubSyncConfig, Order, Payout, SiteConfig, User, UserRole } from '../../src/types';

/* Minimal Cloudflare Pages Function ambient types (zero external @cloudflare/workers-types needed) */
interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  getWithMetadata?<M = unknown>(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null; metadata: M | null }>;
  put(key: string, value: string | ArrayBuffer | Uint8Array, options?: { metadata?: unknown }): Promise<void>;
  delete?(key: string): Promise<void>;
}

interface R2ObjectLike {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}

interface R2BucketLike {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
}

interface CfEnv {
  SANTALSTOCK_KV?: KVNamespaceLike;
  SANTALSTOCK_R2?: R2BucketLike;
  SERPAPI_KEY?: string;
  /** Optional: long random text used to sign login tokens. */
  SESSION_SECRET?: string;
  /** Testing only: "1" shows OTP on screen when email is not set up. Never set on the live site. */
  ALLOW_SCREEN_OTP?: string;
  RESEND_API_KEY?: string;
  EMAILJS_SERVICE_ID?: string;
  EMAILJS_TEMPLATE_ID?: string;
  EMAILJS_PUBLIC_KEY?: string;
  EMAILJS_PRIVATE_KEY?: string;
  /** Optional 2nd EmailJS template for new feedback / message alerts to the owner. */
  EMAILJS_ALERT_TEMPLATE_ID?: string;
  /** Where feedback alerts go (default sunitasoran98@gmail.com). */
  ADMIN_ALERT_EMAIL?: string;
  EMAIL_FROM?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
}

interface CfContext {
  request: Request;
  env: CfEnv;
  params: { path?: string | string[] };
  waitUntil?: (p: Promise<unknown>) => void;
}

function cleanMobile(v: unknown): string {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

interface StoredUser extends User {
  pwHash: string;
  pwSalt: string;
  otpCode?: string;
  otpExpires?: number;
  resetCode?: string;
  resetExpires?: number;
  resetTries?: number;
  resetSentAt?: number;
  /** Tokens issued before this time are invalid (set on password reset). */
  tokenEpoch?: number;
}

interface SessionRecord {
  token: string;
  email: string;
  createdAt: number;
}

interface Database {
  users: StoredUser[];
  sessions: SessionRecord[];
  assets: Asset[];
  deletedSeed: string[];
  orders: Order[];
  payouts: Payout[];
  lightbox: Record<string, Record<string, string[]>>;
  newsletter: string[];
  messages: ContactMessage[];
  siteConfig: SiteConfig;
  githubSync: GitHubSyncConfig;
  sessionSecret?: string;
  revoked?: string[];
}

function defaultGitHubSync(env: CfEnv): GitHubSyncConfig {
  return {
    owner: String(env.GITHUB_OWNER || '').trim(),
    repo: String(env.GITHUB_REPO || '').trim(),
    branch: String(env.GITHUB_BRANCH || 'main').trim() || 'main',
    autoSync: false,
  };
}

const DB_KV_KEY = 'santalstock_db_v1';
const DEMO_ADMIN_EMAIL = 'admin@santalstock.in';
const OWNER_ADMIN_EMAILS = new Set([DEMO_ADMIN_EMAIL, 'sunitasoran98@gmail.com']);
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'trashmail.com',
  'fakeinbox.com',
]);

// Ephemeral fallback if KV is not yet bound in Cloudflare Pages settings
let MEMORY_DB: Database | null = null;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex(len = 16): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

function makeOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const s = salt || randomHex(16);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(s), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: toHex(new Uint8Array(bits)), salt: s };
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const derived = await hashPassword(password, salt);
  if (derived.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= derived.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

function sanitizeUser(u: StoredUser): User {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    emailVerified: u.emailVerified,
    credits: u.credits || 0,
    plan: u.plan || null,
    joined: u.joined,
    company: u.company || '',
    gstin: u.gstin || '',
    state: u.state || 'Jharkhand',
    pin: u.pin || '',
    payout: u.payout || {},
  };
}

function deepMergeConfig(saved: Partial<SiteConfig> | undefined): SiteConfig {
  const def = structuredClone(DEFAULT_SITE_CONFIG);
  if (!saved) return def;
  return {
    ...def,
    ...saved,
    brand: { ...def.brand, ...(saved.brand || {}) },
    hero: { ...def.hero, ...(saved.hero || {}) },
    ctaBanner: { ...def.ctaBanner, ...(saved.ctaBanner || {}) },
    pricing: {
      ...def.pricing,
      ...(saved.pricing || {}),
      royalty: { ...def.pricing.royalty, ...(saved.pricing?.royalty || {}) },
      // v28: download sizes are fixed (330 / 960 / 1280 / Full); old saved size lists are ignored.
      sizes: def.pricing.sizes,
      matrix: {
        std: { ...def.pricing.matrix.std, ...(saved.pricing?.matrix?.std || {}) },
        ext: { ...def.pricing.matrix.ext, ...(saved.pricing?.matrix?.ext || {}) },
        ed: { ...def.pricing.matrix.ed, ...(saved.pricing?.matrix?.ed || {}) },
      },
      licMeta: {
        std: { ...def.pricing.licMeta.std, ...(saved.pricing?.licMeta?.std || {}) },
        ext: { ...def.pricing.licMeta.ext, ...(saved.pricing?.licMeta?.ext || {}) },
        ed: { ...def.pricing.licMeta.ed, ...(saved.pricing?.licMeta?.ed || {}) },
      },
    },
    pages: {
      about: { ...def.pages.about, ...(saved.pages?.about || {}) },
      privacy: { ...def.pages.privacy, ...(saved.pages?.privacy || {}) },
      refund: { ...def.pages.refund, ...(saved.pages?.refund || {}) },
      terms: { ...def.pages.terms, ...(saved.pages?.terms || {}) },
    },
    contact: { ...def.contact, ...(saved.contact || {}) },
    footer: { ...def.footer, ...(saved.footer || {}) },
    settings: { ...def.settings, ...(saved.settings || {}) },
  };
}

async function createInitialDb(env: CfEnv): Promise<Database> {
  const adminPw = await hashPassword('admin123');
  return {
    users: [
      {
        email: 'admin@santalstock.in',
        name: 'Admin',
        role: 'admin',
        emailVerified: true,
        credits: 50,
        plan: null,
        joined: new Date().toISOString(),
        state: 'Jharkhand',
        payout: {},
        pwHash: adminPw.hash,
        pwSalt: adminPw.salt,
      },
    ],
    sessions: [],
    assets: [],
    deletedSeed: [],
    orders: [],
    payouts: [],
    lightbox: {},
    newsletter: [],
    messages: [],
    siteConfig: structuredClone(DEFAULT_SITE_CONFIG),
    githubSync: defaultGitHubSync(env),
    sessionSecret: randomHex(32),
    revoked: [],
  };
}

// v21: safety for the single-record database.
// - A KV read error never creates (or saves) an empty database over the real one.
// - A brand-new database is written only if KV really has nothing.
// - Every save re-reads KV and keeps users/photos/orders/messages that another request added
//   meanwhile, so one stale request cannot erase the owner admin or new uploads.
const FRESH_DB = new WeakSet<object>();
const DELETED_IDS = new WeakMap<object, Set<string>>();
function markDeleted(db: Database, kind: string, id: string): void {
  let set = DELETED_IDS.get(db);
  if (!set) DELETED_IDS.set(db, (set = new Set()));
  set.add(`${kind}:${id}`);
}
class DbUnavailableError extends Error {}

function normalizeDb(parsed: Partial<Database>, init: Database, env: CfEnv): Database {
  return {
    users: parsed.users?.length ? parsed.users : init.users,
    sessions: parsed.sessions || [],
    assets: parsed.assets || [],
    deletedSeed: parsed.deletedSeed || [],
    orders: parsed.orders || [],
    payouts: parsed.payouts || [],
    lightbox: parsed.lightbox || {},
    newsletter: parsed.newsletter || [],
    messages: parsed.messages || [],
    siteConfig: deepMergeConfig(parsed.siteConfig),
    githubSync: { ...defaultGitHubSync(env), ...(parsed.githubSync || {}) },
    sessionSecret: parsed.sessionSecret || init.sessionSecret,
    revoked: parsed.revoked || [],
  };
}

async function readStoredDb(env: CfEnv): Promise<Partial<Database> | null> {
  let raw: string | null;
  try {
    raw = await env.SANTALSTOCK_KV!.get(DB_KV_KEY);
  } catch (e) {
    throw new DbUnavailableError('KV read failed: ' + (e as Error).message);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<Database>;
  } catch {
    throw new DbUnavailableError('Database record could not be read.');
  }
}

async function loadDb(env: CfEnv): Promise<Database> {
  if (env.SANTALSTOCK_KV) {
    const parsed = await readStoredDb(env);
    const init = await createInitialDb(env);
    if (parsed) return normalizeDb(parsed, init, env);
    FRESH_DB.add(init); // written only on the first real save, after a re-check
    return init;
  }

  if (!MEMORY_DB) {
    MEMORY_DB = await createInitialDb(env);
  }
  return MEMORY_DB;
}

function mergeById<T>(ours: T[], theirs: T[] | undefined, key: (x: T) => string, kind: string, deleted: Set<string>): T[] {
  if (!theirs?.length) return ours;
  const have = new Set(ours.map(key));
  const extra = theirs.filter((x) => {
    const k = key(x);
    return k && !have.has(k) && !deleted.has(`${kind}:${k}`);
  });
  return extra.length ? [...ours, ...extra] : ours;
}

async function saveDb(env: CfEnv, db: Database): Promise<void> {
  if (!env.SANTALSTOCK_KV) {
    MEMORY_DB = db;
    return;
  }
  const stored = await readStoredDb(env);
  if (stored) {
    if (FRESH_DB.has(db)) {
      // KV said "empty" earlier but a real database exists: never overwrite it.
      throw new DbUnavailableError('Database was not ready. Please try again.');
    }
    const del = DELETED_IDS.get(db) || new Set<string>();
    db.users = mergeById(db.users, stored.users, (u) => u.email, 'user', del);
    db.assets = mergeById(db.assets, stored.assets, (a) => a.id, 'asset', del);
    db.orders = mergeById(db.orders, stored.orders, (o) => o.id, 'order', del);
    db.payouts = mergeById(db.payouts, stored.payouts, (p) => p.id, 'payout', del);
    db.messages = mergeById(db.messages, stored.messages, (m) => m.id, 'message', del);
    if (stored.revoked?.length) db.revoked = [...new Set([...(db.revoked || []), ...stored.revoked])].slice(-2000);
    if (stored.sessionSecret) db.sessionSecret = stored.sessionSecret;
  }
  const body = JSON.stringify(db);
  // KV allows 1 write per second to the same key; retry instead of crashing (crash = logout before v21).
  for (let i = 0; ; i++) {
    try {
      await env.SANTALSTOCK_KV.put(DB_KV_KEY, body);
      break;
    } catch (e) {
      if (i >= 3) throw new DbUnavailableError('KV write failed: ' + (e as Error).message);
      await new Promise((r) => setTimeout(r, 1100));
    }
  }
  FRESH_DB.delete(db);
}

async function maybeAutoSyncGitHub(env: CfEnv, db: Database, reason: string): Promise<void> {
  if (!env.GITHUB_TOKEN || !db.githubSync.autoSync || !db.githubSync.owner || !db.githubSync.repo) return;
  try {
    const snapshot = buildLiveSnapshotPayload(db.siteConfig, db.assets, db.deletedSeed);
    const res = await pushLiveSnapshotToGitHub(env.GITHUB_TOKEN, db.githubSync, snapshot, reason, false);
    db.githubSync.lastSyncedAt = res.syncedAt;
    db.githubSync.lastCommitSha = res.sha;
    db.githubSync.lastCommitUrl = res.htmlUrl;
    db.githubSync.lastError = '';
    await saveDb(env, db);
  } catch (err) {
    db.githubSync.lastError = (err as Error)?.message || 'Auto-sync failed';
    await saveDb(env, db);
  }
}

async function validateRealEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  const domain = email.split('@')[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, error: 'Temporary/disposable emails are not allowed. Please use a real email account.' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: 'application/dns-json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { Status?: number; Answer?: unknown[] };
      if (data.Status === 3) {
        return { ok: false, error: `Email domain "${domain}" does not exist. Please enter a real email account.` };
      }
      if (data.Status === 0 && (!data.Answer || data.Answer.length === 0)) {
        return {
          ok: false,
          error: `Email domain "${domain}" cannot receive emails. Please use a real email account (e.g., Gmail, Outlook).`,
        };
      }
    }
  } catch {
    // If DoH lookup times out, allow syntactically valid non-disposable email
  }
  return { ok: true };
}

const v = (x?: string) => String(x || '').trim();
function emailConfigured(env: CfEnv): boolean {
  return !!v(env.RESEND_API_KEY) || !!(v(env.EMAILJS_SERVICE_ID) && v(env.EMAILJS_TEMPLATE_ID) && v(env.EMAILJS_PUBLIC_KEY) && v(env.EMAILJS_PRIVATE_KEY));
}

async function sendViaEmailJs(env: CfEnv, to: string, subject: string, code: string, purpose: string): Promise<boolean> {
  if (!(v(env.EMAILJS_SERVICE_ID) && v(env.EMAILJS_TEMPLATE_ID) && v(env.EMAILJS_PUBLIC_KEY) && v(env.EMAILJS_PRIVATE_KEY))) return false;
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SantalStock/1.0 (+https://santalstock.pages.dev)', Origin: 'https://santalstock.pages.dev' },
      body: JSON.stringify({
        service_id: v(env.EMAILJS_SERVICE_ID),
        template_id: v(env.EMAILJS_TEMPLATE_ID),
        user_id: v(env.EMAILJS_PUBLIC_KEY),
        accessToken: v(env.EMAILJS_PRIVATE_KEY),
        template_params: { to_email: to, subject, code, purpose, minutes: purpose === 'password reset' ? '10' : '15', site: 'SantalStock' },
      }),
    });
    if (!res.ok) LAST_EMAIL_ERROR = `EmailJS ${res.status}: ${(await res.text()).slice(0, 200)}`;
    else LAST_EMAIL_ERROR = '';
    return res.ok;
  } catch (e) {
    LAST_EMAIL_ERROR = `EmailJS network error: ${(e as Error)?.message || e}`;
    return false;
  }
}
let LAST_EMAIL_ERROR = '';

/** Emails the owner when a new feedback / suggestion / message arrives. Never blocks the user. */
async function sendFeedbackAlert(env: CfEnv, m: ContactMessage): Promise<void> {
  const to = v(env.ADMIN_ALERT_EMAIL) || 'sunitasoran98@gmail.com';
  const subject = `SantalStock: new ${m.kind || 'message'} from ${m.name} (${m.id})`;
  const stars = m.rating ? '★'.repeat(m.rating) + '☆'.repeat(5 - m.rating) : '-';
  const text = `Type: ${m.kind || 'Contact message'}\nTicket: ${m.id}\nName: ${m.name}\nEmail: ${m.email}\nMobile: ${m.mobile ? '+91 ' + m.mobile : '-'}\nStars: ${stars}\nPage: ${m.page || '-'}\nTime: ${new Date(m.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n${m.message}\n\nReply: just reply to this email, or open Admin → Messages & Feedback.`;
  try {
    if (v(env.EMAILJS_ALERT_TEMPLATE_ID) && v(env.EMAILJS_SERVICE_ID) && v(env.EMAILJS_PUBLIC_KEY) && v(env.EMAILJS_PRIVATE_KEY)) {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'SantalStock/1.0 (+https://santalstock.pages.dev)', Origin: 'https://santalstock.pages.dev' },
        body: JSON.stringify({
          service_id: v(env.EMAILJS_SERVICE_ID),
          template_id: v(env.EMAILJS_ALERT_TEMPLATE_ID),
          user_id: v(env.EMAILJS_PUBLIC_KEY),
          accessToken: v(env.EMAILJS_PRIVATE_KEY),
          template_params: {
            to_email: to, subject, reply_to: m.email, kind: m.kind || 'Contact message', ticket: m.id,
            name: m.name, email: m.email, mobile: m.mobile ? '+91 ' + m.mobile : '-', stars, page: m.page || '-',
            message: m.message, details: text,
          },
        }),
      });
      if (!res.ok) LAST_EMAIL_ERROR = `Alert EmailJS ${res.status}: ${(await res.text()).slice(0, 200)}`;
      return;
    }
    if (v(env.RESEND_API_KEY)) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${v(env.RESEND_API_KEY)}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM || 'SantalStock <onboarding@resend.dev>', to: [to], reply_to: m.email, subject, text }),
      });
    }
  } catch (e) {
    LAST_EMAIL_ERROR = `Alert error: ${(e as Error)?.message || e}`;
  }
}

async function sendVerificationEmail(
  env: CfEnv,
  to: string,
  subject: string,
  code: string,
  purpose: string
): Promise<{ sentViaSmtp: boolean }> {
  if (env.RESEND_API_KEY) {
    try {
      const from = env.EMAIL_FROM || 'SantalStock <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text: `Your SantalStock ${purpose} code is: ${code}\n\nThis code expires in ${purpose === 'password reset' ? 10 : 15} minutes.`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
            <h2 style="margin:0 0 8px"><span style="color:#d6262f">SANTAL</span><span style="color:#0f766e">STOCK</span></h2>
            <p style="color:#334155">Your ${purpose} verification code is:</p>
            <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#011f43;background:#f1f5f9;padding:16px;text-align:center;border-radius:8px;margin:16px 0">${code}</div>
            <p style="color:#64748b;font-size:13px">This code is valid for ${purpose === 'password reset' ? 10 : 15} minutes. If you did not request this, you can safely ignore this email.</p>
          </div>`,
        }),
      });
      if (res.ok) return { sentViaSmtp: true };
    } catch {
      // try EmailJS next
    }
  }
  if (await sendViaEmailJs(env, to, subject, code, purpose)) return { sentViaSmtp: true };
  return { sentViaSmtp: false };
}

function extractToken(request: Request): string {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)ss_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

/* ===== Long-lived signed login tokens =====
 * Token = v2.<email b64url>.<issuedAt>.<rand>.<hmac>. The signature lets a refresh be
 * recognised even if KV has not caught up yet, so admin stays logged in after reload.
 * Admin tokens never expire; others last 90 days. Logout revokes the token.
 */
const USER_TOKEN_DAYS = 90;
const VERIFIED_AUTH = new WeakMap<Request, string>();

function b64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str: string): string {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return decodeURIComponent(escape(atob(pad)));
}
// v21: login tokens are signed with a secret that never changes between requests:
// SESSION_SECRET if set, else one derived from the EmailJS private key (already a Cloudflare secret).
// Older tokens signed with the database secret are still accepted.
async function stableSecret(env: CfEnv): Promise<string | null> {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const base = (env.EMAILJS_PRIVATE_KEY || '').trim();
  if (!base) return null;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('santalstock-session-v1|' + base));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sessionSecretOf(env: CfEnv, db: Database): Promise<string> {
  const st = await stableSecret(env);
  if (st) return st;
  if (!db.sessionSecret) db.sessionSecret = randomHex(32);
  return db.sessionSecret;
}
type TokenStatus = 'none' | 'ok' | 'pending' | 'invalid';
const TOKEN_STATUS = new WeakMap<Request, TokenStatus>();
function tokenStatusOf(request: Request): TokenStatus {
  return TOKEN_STATUS.get(request) || (extractToken(request) ? 'invalid' : 'none');
}
async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function makeSignedToken(env: CfEnv, db: Database, email: string): Promise<string> {
  const e = b64url(email);
  const iat = String(Date.now());
  const rand = randomHex(12);
  const sig = await hmacHex(await sessionSecretOf(env, db), `${e}.${iat}.${rand}`);
  return `v2.${e}.${iat}.${rand}.${sig}`;
}
/** Verifies a signed token once per request (async), so getAuthUser can stay sync. */
async function preVerifyToken(request: Request, env: CfEnv, db: Database): Promise<void> {
  const token = extractToken(request);
  if (!token) return void TOKEN_STATUS.set(request, 'none');
  if (!token.startsWith('v2.')) {
    const ok = db.sessions.some((x) => x.token === token);
    return void TOKEN_STATUS.set(request, ok ? 'ok' : 'invalid');
  }
  const bad = () => void TOKEN_STATUS.set(request, 'invalid');
  const parts = token.split('.');
  if (parts.length !== 5) return bad();
  const [, e, iat, rand, sig] = parts;
  if (db.revoked?.includes(sig)) return bad();
  const data = `${e}.${iat}.${rand}`;
  const secrets = [await stableSecret(env), db.sessionSecret].filter(Boolean) as string[];
  let match = false;
  for (const sec of secrets) if ((await hmacHex(sec, data)) === sig) match = true;
  if (!match) return bad();
  let email = '';
  try {
    email = unb64url(e);
  } catch {
    return bad();
  }
  const u = db.users.find((x) => x.email === email);
  // Signature is genuine but this copy of the database does not have the user yet
  // (Cloudflare KV can take up to a minute to sync): keep the login, do not log out.
  if (!u) return void TOKEN_STATUS.set(request, 'pending');
  const issued = Number(iat);
  if (u.tokenEpoch && issued < u.tokenEpoch) return bad();
  if (u.role !== 'admin' && Date.now() - issued > USER_TOKEN_DAYS * 86400_000) return bad();
  VERIFIED_AUTH.set(request, email);
  TOKEN_STATUS.set(request, 'ok');
}

function getAuthUser(request: Request, db: Database): StoredUser | null {
  const signed = VERIFIED_AUTH.get(request);
  if (signed) return db.users.find((u) => u.email === signed) || null;
  const token = extractToken(request);
  if (!token || token.startsWith('v2.')) return null;
  const sess = db.sessions.find((s) => s.token === token);
  if (!sess) return null;
  return db.users.find((u) => u.email === sess.email) || null;
}

function getCatalog(db: Database, user: StoredUser | null): Asset[] {
  const ovIds = new Set(db.assets.map((a) => a.id));
  const delIds = new Set(db.deletedSeed);
  const seeds = SEED_ASSETS.filter((a) => !ovIds.has(a.id) && !delIds.has(a.id));
  const all = [...db.assets, ...seeds];
  if (user?.role === 'admin') return all;
  return all.filter((a) => a.status === 'approved' || (user && a.owner === user.email));
}

function licKey(): string {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = new Uint8Array(12);
  crypto.getRandomValues(rand);
  let s = 'SSL-';
  for (let i = 0; i < 12; i++) {
    s += c[rand[i] % c.length];
    if (i % 4 === 3 && i < 11) s += '-';
  }
  return s;
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // browsers cap cookies at ~400 days; it is renewed on every visit

function sessionCookie(token: string): string {
  return `ss_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${COOKIE_MAX_AGE}`;
}

async function createSession(env: CfEnv, db: Database, email: string): Promise<{ token: string; cookie: string }> {
  const token = await makeSignedToken(env, db, email);
  // Old style KV sessions are no longer needed; drop expired ones to keep the DB small.
  db.sessions = db.sessions.filter((x) => Date.now() - x.createdAt < 30 * 24 * 60 * 60 * 1000);
  if (db.revoked && db.revoked.length > 2000) db.revoked = db.revoked.slice(-2000);
  await saveDb(env, db);
  return { token, cookie: sessionCookie(token) };
}

/* ================= PHOTO SERIAL (v22) ================= */
function nextPhotoSerial(db: Database): number {
  let max = 0;
  for (const a of db.assets) {
    if (a.serial && a.serial > max) max = a.serial;
    const m = /^SSP(\d+)/.exec(a.id);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return max + 1;
}
/** "Santal Huru Get" + 1 -> "Santal Huru Get#01" (any old #NN at the end is replaced). */
function withSerial(title: string, serial: number): string {
  const base = title.replace(/\s*#\d+\s*$/, '').trim().slice(0, 110) || 'Untitled Photo';
  return `${base}#${String(serial).padStart(2, '0')}`;
}

/* ================= IMAGE STORAGE (R2 or KV) ================= */
// Photos go to the R2 bucket; KV keeps only the short /api/img/... path.
function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: string } | null {
  const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m || !m[2]) return null;
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: m[1] || 'image/jpeg' };
}

// Where photos live: R2 bucket if bound, else each photo as its OWN KV key ("img:prev/<id>.jpg").
// The main database only keeps the short /api/img/... path, so it stays small and fast.
function imageStoreReady(env: CfEnv): boolean {
  return !!env.SANTALSTOCK_R2 || !!env.SANTALSTOCK_KV;
}

async function storeImage(env: CfEnv, kind: 'prev' | 'full', id: string, value: string): Promise<string> {
  if (!imageStoreReady(env) || !value.startsWith('data:')) return value;
  const parsed = dataUrlToBytes(value);
  if (!parsed) return value;
  const key = `${kind}/${id}.jpg`;
  if (env.SANTALSTOCK_R2) {
    await env.SANTALSTOCK_R2.put(key, parsed.bytes, { httpMetadata: { contentType: parsed.type } });
  } else {
    await env.SANTALSTOCK_KV!.put(`img:${key}`, parsed.bytes, { metadata: { type: parsed.type } });
  }
  return `/api/img/${key}?v=${Date.now().toString(36)}`;
}

async function deleteImages(env: CfEnv, id: string): Promise<void> {
  const keys = ['prev', 'full'].map((k) => `${k}/${id}.jpg`);
  if (env.SANTALSTOCK_R2) await Promise.all(keys.map((k) => env.SANTALSTOCK_R2!.delete(k).catch(() => undefined)));
  const kv = env.SANTALSTOCK_KV;
  if (kv && kv.delete) await Promise.all(keys.map((k) => kv.delete!(`img:${k}`).catch(() => undefined)));
}

// Moves any photo still saved inside the database (base64) out to R2 or its own KV key. Runs once.
async function migrateImagesToR2(env: CfEnv, db: Database): Promise<number> {
  if (!imageStoreReady(env)) return 0;
  let moved = 0;
  for (const a of db.assets) {
    const full = a.fullUrl && a.fullUrl !== a.prevUrl ? a.fullUrl : '';
    if (a.prevUrl && a.prevUrl.startsWith('data:')) {
      a.prevUrl = await storeImage(env, 'prev', a.id, a.prevUrl);
      moved++;
    }
    if (full && full.startsWith('data:')) {
      a.fullUrl = await storeImage(env, 'full', a.id, full);
      moved++;
    } else if (a.fullUrl && a.fullUrl.startsWith('data:')) {
      a.fullUrl = a.prevUrl;
    }
  }
  return moved;
}

async function serveImage(env: CfEnv, key: string, publicCache: boolean): Promise<Response> {
  const cache = publicCache ? 'public, max-age=31536000, immutable' : 'private, max-age=3600';
  if (env.SANTALSTOCK_R2) {
    const obj = await env.SANTALSTOCK_R2.get(key);
    if (obj) {
      return new Response(obj.body, {
        headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
      });
    }
  }
  const kv = env.SANTALSTOCK_KV;
  if (kv) {
    let body: ArrayBuffer | null = null;
    let type = 'image/jpeg';
    if (kv.getWithMetadata) {
      const r = await kv.getWithMetadata<{ type?: string }>(`img:${key}`, 'arrayBuffer');
      body = r.value;
      if (r.metadata?.type) type = r.metadata.type;
    } else {
      body = await kv.get(`img:${key}`, 'arrayBuffer');
    }
    if (body) return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
  }
  if (!imageStoreReady(env)) return json({ error: 'Image storage not configured (bind SANTALSTOCK_KV).' }, 404);
  return json({ error: 'Image not found.' }, 404);
}

/* ================= DUPLICATE DETECTION: LAYER 3 (INTERNET) ================= */
type WebCheck = NonNullable<Asset['web']>;

async function webReverseSearch(env: CfEnv, absUrl: string, ownHost: string): Promise<WebCheck> {
  const checked = new Date().toISOString();
  if (!env.SERPAPI_KEY) return { checked, count: 0, links: [], error: 'SERPAPI_KEY not set' };
  try {
    const q = new URLSearchParams({ engine: 'google_lens', type: 'exact_matches', url: absUrl, api_key: env.SERPAPI_KEY });
    const res = await fetch(`https://serpapi.com/search.json?${q}`);
    const j = (await res.json().catch(() => ({}))) as { error?: string; exact_matches?: unknown[]; visual_matches?: unknown[] };
    if (j.error) return { checked, count: 0, links: [], error: String(j.error).slice(0, 200) };
    const arr = (j.exact_matches || j.visual_matches || []) as { title?: string; link?: string; source?: string }[];
    const ext = arr.filter((m) => {
      try {
        return !!m.link && new URL(m.link).hostname !== ownHost;
      } catch {
        return false;
      }
    });
    return {
      checked,
      count: ext.length,
      links: ext.slice(0, 5).map((m) => ({ title: String(m.title || m.link).slice(0, 140), url: String(m.link), source: m.source ? String(m.source) : undefined })),
    };
  } catch (e) {
    return { checked, count: 0, links: [], error: (e as Error).message.slice(0, 200) };
  }
}

async function runWebCheck(env: CfEnv, origin: string, id: string): Promise<WebCheck | null> {
  const db = await loadDb(env);
  const a = db.assets.find((x) => x.id === id);
  if (!a || !a.prevUrl || !a.prevUrl.startsWith('/api/img/')) return null;
  const web = await webReverseSearch(env, origin + a.prevUrl, new URL(origin).hostname);
  const fresh = await loadDb(env);
  const rec = fresh.assets.find((x) => x.id === id);
  if (rec) {
    rec.web = web;
    await saveDb(env, fresh);
  }
  return web;
}

export async function onRequest(context: CfContext): Promise<Response> {
  try {
    return await handleRequest(context);
  } catch (e) {
    const msg = e instanceof DbUnavailableError ? 'Server busy, please try again in a moment.' : 'Server error, please try again.';
    return json({ error: msg, retry: true }, 503, { 'Retry-After': '2' });
  }
}

async function handleRequest(context: CfContext): Promise<Response> {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '');

  // Public preview images are served straight from R2 (no KV read, cached by browsers/CDN).
  const prevImg = pathname.match(/^\/api\/img\/prev\/([A-Za-z0-9_-]+)\.jpg$/);
  if (method === 'GET' && prevImg) return serveImage(env, `prev/${prevImg[1]}.jpg`, true);

  const db = await loadDb(env);
  await preVerifyToken(request, env, db);

  if (imageStoreReady(env) && db.assets.some((a) => (a.prevUrl || '').startsWith('data:') || (a.fullUrl || '').startsWith('data:'))) {
    try {
      if ((await migrateImagesToR2(env, db)) > 0) await saveDb(env, db);
    } catch {
      // keep serving; migration retries on the next request
    }
  }

  // Full-size files: only admin, the photo's owner, or a buyer with a paid order.
  const fullImg = pathname.match(/^\/api\/img\/full\/([A-Za-z0-9_-]+)\.jpg$/);
  if (method === 'GET' && fullImg) {
    const id = fullImg[1];
    const u = getAuthUser(request, db);
    const asset = db.assets.find((a) => a.id === id);
    const allowed =
      !!u &&
      (u.role === 'admin' ||
        asset?.owner === u.email ||
        db.orders.some((o) => o.user === u.email && (!o.status || o.status === 'paid') && o.items.some((i) => i.id === id)));
    if (!allowed) return json({ error: 'Buy a license to download the full-size file.' }, 403);
    return serveImage(env, `full/${id}.jpg`, false);
  }

  /* ================= AUTH ROUTES ================= */
  // Open in browser: /api/email-status  -> shows which email settings this deploy can see (never the values).
  if (method === 'GET' && pathname === '/api/email-status') {
    return json({
      deployHasCode: 'v31',
      photoStore: env.SANTALSTOCK_R2 ? 'R2' : env.SANTALSTOCK_KV ? 'KV (one key per photo)' : 'none',
      EMAILJS_SERVICE_ID: !!v(env.EMAILJS_SERVICE_ID),
      EMAILJS_TEMPLATE_ID: !!v(env.EMAILJS_TEMPLATE_ID),
      EMAILJS_PUBLIC_KEY: !!v(env.EMAILJS_PUBLIC_KEY),
      EMAILJS_PRIVATE_KEY: !!v(env.EMAILJS_PRIVATE_KEY),
      EMAILJS_ALERT_TEMPLATE_ID: !!v(env.EMAILJS_ALERT_TEMPLATE_ID),
      ADMIN_ALERT_EMAIL: v(env.ADMIN_ALERT_EMAIL) || 'sunitasoran98@gmail.com (default)',
      RESEND_API_KEY: !!v(env.RESEND_API_KEY),
      ALLOW_SCREEN_OTP: env.ALLOW_SCREEN_OTP === '1',
      SERPAPI_KEY: !!v(env.SERPAPI_KEY),
      SANTALSTOCK_KV: !!env.SANTALSTOCK_KV,
      SANTALSTOCK_R2: !!env.SANTALSTOCK_R2,
      ownerAdminSet: db.users.some((x) => x.role === 'admin' && x.email === 'sunitasoran98@gmail.com'),
      demoAdminActive: db.users.some((x) => x.email === DEMO_ADMIN_EMAIL),
      emailReady: emailConfigured(env),
      lastError: LAST_EMAIL_ERROR || null,
    });
  }
  if (method === 'GET' && pathname === '/api/auth/me') {
    const u = getAuthUser(request, db);
    return json({
      user: u ? sanitizeUser(u) : null,
      tokenStatus: tokenStatusOf(request),
      smtpConfigured: Boolean(env.RESEND_API_KEY),
      cloudflareKv: Boolean(env.SANTALSTOCK_KV),
      cloudflareR2: Boolean(env.SANTALSTOCK_R2),
      webCheck: Boolean(env.SERPAPI_KEY),
    });
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    const body = await readBody(request);
    if (!emailConfigured(env) && env.ALLOW_SCREEN_OTP !== '1') {
      return json({ error: 'Email service is not set up yet. Please contact support.' }, 503);
    }
    const email = String(body.email || '').trim().toLowerCase();
    const cleanName = String(body.name || '').trim();
    const pw = String(body.password || '');
    const mobile = cleanMobile(body.mobile);
    const role = body.role;

    if (!cleanName || cleanName.length < 2) return json({ error: 'Please enter your full name.' }, 400);
    if (pw.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);
    if (!mobile) return json({ error: 'Please enter a valid 10-digit mobile number.' }, 400);

    if (role === 'admin' && !OWNER_ADMIN_EMAILS.has(email)) return json({ error: 'Only the owner email can set up Admin. Please login as Buyer or Contributor.' }, 403);
    const check = await validateRealEmail(email);
    if (!check.ok) return json({ error: check.error }, 400);

    const existing = db.users.find((u) => u.email === email);
    if (existing && existing.emailVerified) {
      return json({ error: 'This email is already registered. Please login, or use Forgot password.' }, 400);
    }

    const { hash, salt } = await hashPassword(pw);
    const otpCode = makeOtp();
    const otpExpires = Date.now() + 15 * 60 * 1000;
    const assignedRole: UserRole = OWNER_ADMIN_EMAILS.has(email)
      ? 'admin'
      : role === 'contributor'
      ? 'contributor'
      : 'buyer';

    if (existing) {
      existing.name = cleanName;
      existing.mobile = mobile;
      existing.pwHash = hash;
      existing.pwSalt = salt;
      existing.role = assignedRole;
      existing.otpCode = otpCode;
      existing.otpExpires = otpExpires;
    } else {
      db.users.push({
        email,
        name: cleanName,
        mobile,
        role: assignedRole,
        emailVerified: false,
        credits: 0,
        plan: null,
        joined: new Date().toISOString(),
        state: 'Jharkhand',
        payout: {},
        pwHash: hash,
        pwSalt: salt,
        otpCode,
        otpExpires,
      });
    }
    await saveDb(env, db);

    const delivery = await sendVerificationEmail(env, email, 'Verify your SantalStock email', otpCode, 'email verification');
    return json({
      verificationRequired: true,
      email,
      sentViaSmtp: delivery.sentViaSmtp,
      previewCode: delivery.sentViaSmtp || env.ALLOW_SCREEN_OTP !== '1' ? undefined : otpCode,
      message: delivery.sentViaSmtp
        ? `Verification code sent to ${email}. Check your inbox.`
        : `Verification code generated for ${email}.`,
    });
  }

  if (method === 'POST' && pathname === '/api/auth/verify-email') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const cleanCode = String(body.code || '').trim();
    const u = db.users.find((x) => x.email === email);
    if (!u) return json({ error: 'Account not found.' }, 404);
    if (!u.otpCode || u.otpCode !== cleanCode) return json({ error: 'Invalid verification code.' }, 400);
    if (u.otpExpires && Date.now() > u.otpExpires) return json({ error: 'Verification code expired. Please resend.' }, 400);

    u.emailVerified = true;
    u.otpCode = undefined;
    u.otpExpires = undefined;
    if (OWNER_ADMIN_EMAILS.has(u.email)) u.role = 'admin';
    if (u.role === 'admin' && u.email !== DEMO_ADMIN_EMAIL) {
      // Real owner admin is ready: switch off the demo admin login (admin@santalstock.in / admin123).
      markDeleted(db, 'user', DEMO_ADMIN_EMAIL);
      db.users = db.users.filter((x) => x.email !== DEMO_ADMIN_EMAIL);
      db.sessions = db.sessions.filter((x) => x.email !== DEMO_ADMIN_EMAIL);
    }

    const { token, cookie } = await createSession(env, db, u.email);
    return json({ user: sanitizeUser(u), token }, 200, { 'Set-Cookie': cookie });
  }

  if (method === 'POST' && pathname === '/api/auth/resend-otp') {
    const body = await readBody(request);
    if (!emailConfigured(env) && env.ALLOW_SCREEN_OTP !== '1') {
      return json({ error: 'Email service is not set up yet. Please contact support.' }, 503);
    }
    const email = String(body.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email);
    if (!u) return json({ error: 'Account not found.' }, 404);
    const otpCode = makeOtp();
    u.otpCode = otpCode;
    u.otpExpires = Date.now() + 15 * 60 * 1000;
    await saveDb(env, db);

    const delivery = await sendVerificationEmail(env, email, 'Your new SantalStock verification code', otpCode, 'email verification');
    return json({
      sentViaSmtp: delivery.sentViaSmtp,
      previewCode: delivery.sentViaSmtp || env.ALLOW_SCREEN_OTP !== '1' ? undefined : otpCode,
      message: delivery.sentViaSmtp ? `New code sent to ${email}.` : 'New verification code generated.',
    });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const u = db.users.find((x) => x.email === email);
    if (!u || !(await verifyPassword(password, u.pwHash, u.pwSalt))) {
      return json({ error: 'Incorrect email or password.' }, 401);
    }
    if (!u.emailVerified) {
      const otpCode = makeOtp();
      u.otpCode = otpCode;
      u.otpExpires = Date.now() + 15 * 60 * 1000;
      await saveDb(env, db);
      const delivery = await sendVerificationEmail(env, email, 'Verify your SantalStock email', otpCode, 'email verification');
      return json({
        verificationRequired: true,
        email,
        sentViaSmtp: delivery.sentViaSmtp,
        previewCode: delivery.sentViaSmtp || env.ALLOW_SCREEN_OTP !== '1' ? undefined : otpCode,
        message: 'Please verify your email address before signing in.',
      });
    }
    if (OWNER_ADMIN_EMAILS.has(u.email) && u.role !== 'admin') {
      u.role = 'admin';
    }
    const { token, cookie } = await createSession(env, db, u.email);
    return json({ user: sanitizeUser(u), token }, 200, { 'Set-Cookie': cookie });
  }

  if (method === 'POST' && pathname === '/api/auth/forgot-password') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
    const screenOtp = env.ALLOW_SCREEN_OTP === '1';
    if (!emailConfigured(env) && !screenOtp) {
      return json({ error: 'Email service is not set up yet. Please contact support.' }, 503);
    }
    const u = db.users.find((x) => x.email === email);
    if (!u) return json({ error: 'No account found with this email.' }, 404);
    if (u.resetSentAt && Date.now() - u.resetSentAt < 60_000) {
      const wait = Math.ceil((60_000 - (Date.now() - u.resetSentAt)) / 1000);
      return json({ error: `Please wait ${wait} seconds before asking for a new code.`, retryAfter: wait }, 429);
    }
    const resetCode = makeOtp();
    u.resetCode = resetCode;
    u.resetExpires = Date.now() + 10 * 60 * 1000;
    u.resetTries = 0;
    u.resetSentAt = Date.now();
    await saveDb(env, db);

    const delivery = await sendVerificationEmail(env, email, 'SantalStock Password Reset Code', resetCode, 'password reset');
    if (!delivery.sentViaSmtp && !screenOtp) {
      u.resetSentAt = undefined;
      await saveDb(env, db);
      return json({ error: 'Could not send the email right now. Please try again in a minute.' + (LAST_EMAIL_ERROR ? ' [' + LAST_EMAIL_ERROR + ']' : '') }, 502);
    }
    return json({
      ok: true,
      email,
      sentViaSmtp: delivery.sentViaSmtp,
      previewCode: delivery.sentViaSmtp || env.ALLOW_SCREEN_OTP !== '1' ? undefined : resetCode,
      message: delivery.sentViaSmtp ? `Reset code sent to ${email}. Check inbox & spam.` : 'Test mode: email not set up.',
    });
  }

  if (method === 'POST' && pathname === '/api/auth/reset-password') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);
    const u = db.users.find((x) => x.email === email);
    if (!u || !u.resetCode) return json({ error: 'Please request a new reset code.' }, 400);
    if (u.resetExpires && Date.now() > u.resetExpires) return json({ error: 'Reset code expired. Please request a new one.' }, 400);
    if (u.resetCode !== code) {
      u.resetTries = (u.resetTries || 0) + 1;
      if (u.resetTries >= 5) {
        u.resetCode = undefined;
        u.resetExpires = undefined;
        await saveDb(env, db);
        return json({ error: 'Too many wrong codes. Please request a new code.' }, 429);
      }
      await saveDb(env, db);
      return json({ error: `Wrong code. ${5 - u.resetTries} tries left.` }, 400);
    }

    const { hash, salt } = await hashPassword(newPassword);
    u.pwHash = hash;
    u.pwSalt = salt;
    u.emailVerified = true;
    u.resetCode = undefined;
    u.resetExpires = undefined;
    u.resetTries = 0;
    // Log out every other device that had this account open.
    u.tokenEpoch = Date.now();
    db.sessions = db.sessions.filter((x) => x.email !== u.email);
    const { token, cookie } = await createSession(env, db, u.email);
    return json({ user: sanitizeUser(u), token }, 200, { 'Set-Cookie': cookie });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = extractToken(request);
    if (token) {
      db.sessions = db.sessions.filter((s) => s.token !== token);
      if (token.startsWith('v2.')) {
        const sig = token.split('.')[4];
        if (sig) db.revoked = [...(db.revoked || []), sig].slice(-2000);
      }
      await saveDb(env, db);
    }
    return json({ ok: true }, 200, {
      'Set-Cookie': 'ss_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0',
    });
  }

  if (method === 'PUT' && pathname === '/api/auth/profile') {
    const u = getAuthUser(request, db);
    if (!u) return json({ error: 'Sign in required.' }, 401);
    const body = await readBody(request);
    if (typeof body.name === 'string' && body.name.trim()) u.name = body.name.trim();
    if (typeof body.company === 'string') u.company = body.company.trim();
    if (typeof body.gstin === 'string') u.gstin = body.gstin.trim();
    if (typeof body.state === 'string') u.state = body.state.trim();
    if (typeof body.pin === 'string') u.pin = body.pin.trim();
    if (u.role !== 'admin' && (body.role === 'buyer' || body.role === 'contributor')) u.role = body.role;
    if (body.plan === null) u.plan = null;
    await saveDb(env, db);
    return json({ user: sanitizeUser(u) });
  }

  /* ================= STATE & CMS ================= */
  if (method === 'GET' && pathname === '/api/state') {
    const u = getAuthUser(request, db);
    const assets = getCatalog(db, u);
    const orders = u
      ? u.role === 'admin'
        ? db.orders
        : db.orders
            .filter((o) => o.user === u.email || o.items.some((i) => i.owner === u.email))
            .filter((o) => o.user === u.email || !o.status || o.status === 'paid')
            .map((o) => (o.status && o.status !== 'paid' ? { ...o, items: o.items.map((i) => ({ ...i, key: '' })) } : o))
      : [];
    const payouts = u
      ? u.role === 'admin'
        ? db.payouts
        : db.payouts.filter((p) => p.user === u.email)
      : [];
    const users = u?.role === 'admin' ? db.users.map(sanitizeUser) : [];
    const lightbox = u ? db.lightbox[u.email] || { Favorites: [] } : null;

    const dlCounts: Record<string, number> = {};
    for (const o of db.orders) {
      for (const i of o.items) {
        dlCounts[i.id] = (dlCounts[i.id] || 0) + 1;
      }
    }

    return json({
      user: u ? sanitizeUser(u) : null,
      tokenStatus: tokenStatusOf(request),
      siteConfig: db.siteConfig,
      assets,
      orders,
      payouts,
      users,
      lightbox,
      dlCounts,
      messages: u?.role === 'admin' ? db.messages : [],
    }, 200, u && VERIFIED_AUTH.has(request) ? { 'Set-Cookie': sessionCookie(extractToken(request)) } : {});
  }

  if (method === 'PUT' && pathname === '/api/cms') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const body = await readBody(request);
    db.siteConfig = deepMergeConfig(body.siteConfig as Partial<SiteConfig> | undefined);
    await saveDb(env, db);
    await maybeAutoSyncGitHub(env, db, 'CMS visual update');
    return json({ siteConfig: db.siteConfig });
  }

  if (method === 'POST' && pathname === '/api/cms/reset') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    db.siteConfig = structuredClone(DEFAULT_SITE_CONFIG);
    await saveDb(env, db);
    await maybeAutoSyncGitHub(env, db, 'CMS reset to defaults');
    return json({ siteConfig: db.siteConfig });
  }

  /* ================= ASSETS CRUD ================= */
  if (method === 'POST' && pathname === '/api/assets/check-duplicate') {
    const u = getAuthUser(request, db);
    if (!u || !['contributor', 'admin'].includes(u.role)) return json({ error: 'Contributor or Admin account required.' }, 403);
    const fp = cleanFingerprint(await readBody(request));
    const hits = findDuplicates(fp, db.assets.filter((a) => a.status !== 'rejected'));
    return json({
      matches: hits.map((h) => {
        const a = db.assets.find((x) => x.id === h.id)!;
        const visible = u.role === 'admin' || a.owner === u.email || a.status === 'approved';
        return { ...h, mine: a.owner === u.email, title: visible ? a.title : '', thumb: visible ? a.prevUrl || '' : '', status: a.status };
      }),
    });
  }

  // Admin back-fill: hashes for old photos that were uploaded before duplicate check existed.
  if (method === 'POST' && pathname === '/api/assets/fingerprints') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin only.' }, 403);
    const b = await readBody(request);
    const items = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]).slice(0, 50) : [];
    let n = 0;
    for (const it of items) {
      const rec = db.assets.find((a) => a.id === String(it.id || ''));
      const fp = cleanFingerprint(it);
      if (!rec || !fp.phash) continue;
      rec.phash = fp.phash;
      if (fp.dhash) rec.dhash = fp.dhash;
      n++;
    }
    if (n) await saveDb(env, db);
    return json({ updated: n });
  }

  if (method === 'POST' && pathname === '/api/assets') {
    const u = getAuthUser(request, db);
    if (!u || !['contributor', 'admin'].includes(u.role)) {
      return json({ error: 'Contributor or Admin account required.' }, 403);
    }
    const b = await readBody(request);
    const fp = cleanFingerprint(b);
    const dupHits = findDuplicates(fp, db.assets.filter((a) => a.status !== 'rejected'));
    const exactHit = dupHits.find((h) => h.kind === 'exact');
    if (exactHit && !(u.role === 'admin' && b.force === true)) {
      return json({ error: `Ye photo pehle se SantalStock par hai (${exactHit.id}). Duplicate upload allowed nahi hai.`, duplicate: exactHit }, 409);
    }
    // v22: running serial (#01, #02 …) and a matching unique ID (SSP01, SSP02 …).
    const serial = nextPhotoSerial(db);
    const pad = String(serial).padStart(2, '0');
    let id = 'SSP' + pad;
    for (let n = 2; db.assets.some((a) => a.id === id) || SEED_ASSETS.some((a) => a.id === id); n++) id = `SSP${pad}-${n}`;
    let owner = u.email;
    let contributor = u.name;
    if (u.role === 'admin' && typeof b.assignOwner === 'string' && b.assignOwner) {
      const au = db.users.find((x) => x.email === b.assignOwner);
      if (au) {
        owner = au.email;
        contributor = au.name;
      }
    }
    const asset: Asset = {
      id,
      title: withSerial(String(b.title || 'Untitled Photo'), serial),
      serial,
      desc: String(b.desc || '').trim(),
      kw: Array.isArray(b.kw) ? b.kw.map((k) => String(k).trim().toLowerCase()).filter(Boolean) : [],
      cat: String(b.cat || 'Culture').trim(),
      lic: b.lic === 'editorial' ? 'editorial' : 'rf',
      w: Number(b.w) || 1600,
      h: Number(b.h) || 1067,
      dl: 0,
      date: new Date().toISOString().slice(0, 10),
      contributor,
      owner,
      status: u.role === 'admin' ? 'approved' : 'pending',
      src: 'upload',
      release: b.lic === 'editorial' ? 'na' : String(b.release || 'none'),
      relfile: String(b.relfile || ''),
      caption: String(b.caption || '').trim(),
      evdate: String(b.evdate || ''),
      place: String(b.place || '').trim(),
      prevUrl: await storeImage(env, 'prev', id, String(b.prevUrl || '')),
      fullUrl: await storeImage(env, 'full', id, String(b.fullUrl || b.prevUrl || '')),
      ...fp.sha256 ? { sha256: fp.sha256 } : {},
      ...fp.phash ? { phash: fp.phash } : {},
      ...fp.dhash ? { dhash: fp.dhash } : {},
      ...dupHits.length ? { dup: dupHits } : {},
    };
    db.assets.unshift(asset);
    await saveDb(env, db);
    if (env.SERPAPI_KEY && asset.prevUrl?.startsWith('/api/img/')) {
      // v27: wait up to 15s so the uploader sees the internet result at once; slower checks finish in background.
      const job = runWebCheck(env, url.origin, asset.id).catch(() => null);
      if (context.waitUntil) context.waitUntil(job);
      const web = await Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), 15000))]);
      if (web) asset.web = web;
    }
    if (u.role === 'admin') await maybeAutoSyncGitHub(env, db, `Add photo ${asset.id}`);
    return json({ asset });
  }

  const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetMatch && method === 'PUT') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const id = decodeURIComponent(assetMatch[1]);
    const b = await readBody(request);
    let rec = db.assets.find((x) => x.id === id);
    if (!rec) {
      const seed = SEED_ASSETS.find((x) => x.id === id);
      if (!seed) return json({ error: 'Photo not found.' }, 404);
      rec = { ...seed };
      db.assets.unshift(rec);
    }
    if (typeof b.title === 'string') rec.title = rec.serial ? withSerial(b.title, rec.serial) : b.title.trim();
    if (typeof b.desc === 'string') rec.desc = b.desc.trim();
    if (typeof b.contributor === 'string') rec.contributor = b.contributor.trim();
    if (typeof b.owner === 'string') rec.owner = b.owner;
    if (typeof b.cat === 'string') rec.cat = b.cat.trim();
    if (b.lic === 'rf' || b.lic === 'editorial') rec.lic = b.lic;
    if (b.status === 'approved' || b.status === 'pending' || b.status === 'rejected') rec.status = b.status;
    if (typeof b.place === 'string') rec.place = b.place.trim();
    if (typeof b.caption === 'string') rec.caption = b.caption.trim();
    if (typeof b.reason === 'string') rec.reason = b.reason.trim();
    if (Array.isArray(b.kw)) rec.kw = b.kw.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
    if (b.prevUrl) {
      rec.prevUrl = await storeImage(env, 'prev', rec.id, String(b.prevUrl));
      rec.fullUrl = await storeImage(env, 'full', rec.id, String(b.fullUrl || b.prevUrl));
      rec.w = Number(b.w) || rec.w;
      rec.h = Number(b.h) || rec.h;
      rec.src = 'upload';
      delete rec.pid;
      const fp = cleanFingerprint(b);
      if (fp.sha256) rec.sha256 = fp.sha256;
      if (fp.phash) rec.phash = fp.phash;
      if (fp.dhash) rec.dhash = fp.dhash;
      const hits = findDuplicates(fp, db.assets.filter((a) => a.status !== 'rejected'), rec.id);
      if (hits.length) rec.dup = hits;
      else delete rec.dup;
      delete rec.web;
    }
    await saveDb(env, db);
    await maybeAutoSyncGitHub(env, db, `Update photo ${rec.id}`);
    return json({ asset: rec });
  }

  if (assetMatch && method === 'DELETE') {
    const u = getAuthUser(request, db);
    if (!u) return json({ error: 'Sign in required.' }, 401);
    const id = decodeURIComponent(assetMatch[1]);
    const rec = db.assets.find((x) => x.id === id);
    const isSeed = SEED_ASSETS.some((x) => x.id === id);
    if (u.role !== 'admin' && (!rec || rec.owner !== u.email)) {
      return json({ error: 'Not allowed to delete this photo.' }, 403);
    }
    if (isSeed && !db.deletedSeed.includes(id)) db.deletedSeed.push(id);
    markDeleted(db, 'asset', id);
    db.assets = db.assets.filter((x) => x.id !== id);
    await deleteImages(env, id);
    await saveDb(env, db);
    if (u.role === 'admin') await maybeAutoSyncGitHub(env, db, `Delete photo ${id}`);
    return json({ ok: true });
  }

  const webMatch = pathname.match(/^\/api\/assets\/([^/]+)\/web-check$/);
  if (method === 'POST' && webMatch) {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    if (!env.SERPAPI_KEY) return json({ error: 'Auto internet check ke liye Cloudflare me SERPAPI_KEY daalein. Tab tak manual buttons use karein.' }, 400);
    const web = await runWebCheck(env, url.origin, decodeURIComponent(webMatch[1]));
    if (!web) return json({ error: 'Is photo ka public preview (KV/R2) nahi hai.' }, 400);
    return json({ web });
  }

  /* ================= ORDERS & VERIFY ================= */
  if (method === 'POST' && pathname === '/api/orders') {
    const u = getAuthUser(request, db);
    if (!u) return json({ error: 'Sign in required.' }, 401);
    const body = await readBody(request);
    const kind = body.kind;
    const bill = (body.bill || {}) as Record<string, unknown>;
    const pay = body.pay;
    const reqItems = body.items;
    const licensee = body.licensee;
    const use = body.use;
    const pricing = db.siteConfig.pricing;

    u.company = String(bill.company || u.company || '');
    u.gstin = String(bill.gstin || u.gstin || '');
    u.state = String(bill.state || u.state || 'Jharkhand');
    u.pin = String(bill.pin || u.pin || '');

    const oid = 'SS-ORD-' + Date.now().toString(36).toUpperCase() + randomHex(2).toUpperCase();
    const order: Order = {
      id: oid,
      date: new Date().toISOString(),
      user: u.email,
      bill: {
        name: String(bill.name || u.name),
        email: String(bill.email || u.email),
        company: u.company,
        gstin: u.gstin,
        state: u.state,
        pin: u.pin,
      },
      pay: pay === 'credits' ? 'credits' : 'upi',
      status: pay === 'credits' ? 'paid' : 'pending',
      type: kind === 'cart' ? 'license' : 'credits',
      sub: 0,
      gst: 0,
      total: 0,
      items: [],
    };

    if (order.pay === 'upi') {
      const utr = String(body.utr || '').replace(/\s/g, '');
      if (!/^\d{12}$/.test(utr)) return json({ error: 'Enter the 12-digit UPI transaction ID (UTR).' }, 400);
      if (db.orders.some((x) => x.utr === utr && x.status !== 'rejected')) return json({ error: 'This UTR is already used.' }, 400);
      order.utr = utr;
    }

    if (kind === 'cart') {
      const catalog = getCatalog(db, u);
      const validItems = (Array.isArray(reqItems) ? reqItems : [])
        .map((c: { id: string; lic: 'std' | 'ext' | 'ed'; size: 'XS' | 'S' | 'M' | 'L' }) => {
          const a = catalog.find((x) => x.id === c.id);
          if (!a) return null;
          const unitPrice = pricing.matrix[c.lic]?.[c.size] ?? 19;
          return { ...c, price: unitPrice, asset: a };
        })
        .filter(Boolean) as { id: string; lic: 'std' | 'ext' | 'ed'; size: 'XS' | 'S' | 'M' | 'L'; price: number; asset: Asset }[];

      if (!validItems.length) return json({ error: 'Cart is empty.' }, 400);

      const sub = validItems.reduce((n, i) => n + i.price, 0);
      const gst = Math.round(sub * pricing.gst);
      const crNeed = validItems.reduce((n, i) => n + (pricing.licMeta[i.lic]?.cr || 1), 0);

      if (order.pay === 'credits') {
        if ((u.credits || 0) < crNeed) return json({ error: 'Insufficient credits.' }, 400);
        u.credits -= crNeed;
        order.credits = crNeed;
      } else {
        order.sub = sub;
        order.gst = gst;
        order.total = sub + gst;
      }

      order.items = validItems.map((c) => ({
        id: c.id,
        lic: c.lic,
        size: c.size,
        price: c.price,
        key: licKey(),
        licensee: String(licensee || u.company || u.name),
        use: String(use || 'General media use'),
        title: c.asset.title,
        owner: c.asset.owner,
        lictype: c.asset.lic,
        royalty: Math.round(
          (order.pay === 'credits' ? c.price * 0.6 : c.price) *
            (c.asset.lic === 'editorial' ? pricing.royalty.editorial : pricing.royalty.rf)
        ),
      }));
    } else if (typeof kind === 'string' && kind.startsWith('plan:')) {
      const v = kind.slice(5);
      const P = pricing.plans.find((x) => x.id === v);
      if (!P) return json({ error: 'Plan not found.' }, 404);
      const gst = Math.round(P.p * pricing.gst);
      order.sub = P.p;
      order.gst = gst;
      order.total = P.p + gst;
      order.desc = `${P.n} plan`;
      order.addCr = P.cr;
      order.planId = P.id; // credits + plan activate on admin approval
    } else if (typeof kind === 'string' && kind.startsWith('pack:')) {
      const v = kind.slice(5);
      const P = pricing.packs.find((x) => x.id === v) || pricing.packs[Number(v)];
      if (!P) return json({ error: 'Pack not found.' }, 404);
      const gst = Math.round(P.p * pricing.gst);
      order.sub = P.p;
      order.gst = gst;
      order.total = P.p + gst;
      order.desc = `${P.cr} credit pack`;
      order.addCr = P.cr; // credits activate on admin approval
    } else {
      return json({ error: 'Invalid order type.' }, 400);
    }

    db.orders.unshift(order);
    await saveDb(env, db);
    return json({ order, user: sanitizeUser(u) });
  }


  /* ---- UPI manual verification (HorKathaSuite style) ---- */
  const approveMatch = pathname.match(/^\/api\/orders\/([^/]+)\/(approve|reject)$/);
  if (method === 'POST' && approveMatch) {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const o = db.orders.find((x) => x.id === decodeURIComponent(approveMatch[1]));
    if (!o) return json({ error: 'Order not found.' }, 404);
    if (o.status !== 'pending') return json({ error: 'Order is not pending.' }, 400);
    if (approveMatch[2] === 'approve') {
      o.status = 'paid';
      const buyer = db.users.find((x) => x.email === o.user);
      if (buyer && o.addCr) buyer.credits = (buyer.credits || 0) + o.addCr;
      if (buyer && o.planId) buyer.plan = { id: o.planId, since: new Date().toISOString() };
    } else {
      o.status = 'rejected';
    }
    await saveDb(env, db);
    return json({ order: o });
  }

  if (method === 'GET' && pathname === '/api/verify-license') {
    const key = String(url.searchParams.get('k') || '').trim().toUpperCase();
    if (!key) return json({ valid: false });
    for (const o of db.orders) {
      if (o.status && o.status !== 'paid') continue;
      for (const i of o.items) {
        if (i.key.toUpperCase() === key) {
          return json({
            valid: true,
            license: {
              key: i.key,
              lic: i.lic,
              assetId: i.id,
              title: i.title,
              licensee: i.licensee,
              date: o.date,
            },
          });
        }
      }
    }
    return json({ valid: false });
  }

  /* ================= PAYOUTS, USERS, LIGHTBOX, MISC ================= */
  if (method === 'POST' && pathname === '/api/payouts') {
    const u = getAuthUser(request, db);
    if (!u || !['contributor', 'admin'].includes(u.role)) {
      return json({ error: 'Contributor access required.' }, 403);
    }
    const body = await readBody(request);
    const upi = String(body.upi || '').trim();
    const pan = String(body.pan || '').trim().toUpperCase();
    if (!upi) return json({ error: 'UPI ID required.' }, 400);
    u.payout = { upi, pan };

    const earned = db.orders
      .flatMap((o) => o.items.filter((i) => i.owner === u.email))
      .reduce((n, s) => n + s.royalty, 0);
    const paid = db.payouts.filter((p) => p.user === u.email).reduce((n, p) => n + p.amt, 0);
    const bal = earned - paid;
    if (bal < db.siteConfig.pricing.payoutMin) {
      return json(
        { error: `Minimum payout balance is ${db.siteConfig.pricing.currency}${db.siteConfig.pricing.payoutMin}.` },
        400
      );
    }
    const payout: Payout = {
      id: 'PO' + Date.now().toString(36).toUpperCase(),
      user: u.email,
      amt: bal,
      upi,
      date: new Date().toISOString(),
      status: 'requested',
    };
    db.payouts.unshift(payout);
    await saveDb(env, db);
    return json({ payout });
  }

  const payoutPayMatch = pathname.match(/^\/api\/payouts\/([^/]+)\/pay$/);
  if (payoutPayMatch && method === 'PUT') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const p = db.payouts.find((x) => x.id === decodeURIComponent(payoutPayMatch[1]));
    if (!p) return json({ error: 'Payout not found.' }, 404);
    p.status = 'paid';
    await saveDb(env, db);
    return json({ payout: p });
  }

  const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (userRoleMatch && method === 'PUT') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const targetEmail = decodeURIComponent(userRoleMatch[1]).toLowerCase();
    const target = db.users.find((x) => x.email === targetEmail);
    if (!target) return json({ error: 'User not found.' }, 404);
    const body = await readBody(request);
    const role = body.role;
    if (role !== 'buyer' && role !== 'contributor' && role !== 'admin') {
      return json({ error: 'Invalid role.' }, 400);
    }
    target.role = role;
    await saveDb(env, db);
    return json({ user: sanitizeUser(target) });
  }

  if (method === 'PUT' && pathname === '/api/lightbox') {
    const u = getAuthUser(request, db);
    if (!u) return json({ error: 'Sign in required.' }, 401);
    const body = await readBody(request);
    if (body.lightbox && typeof body.lightbox === 'object') {
      db.lightbox[u.email] = body.lightbox as Record<string, string[]>;
      await saveDb(env, db);
    }
    return json({ lightbox: db.lightbox[u.email] || { Favorites: [] } });
  }

  if (method === 'POST' && pathname === '/api/newsletter') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email.includes('@')) return json({ error: 'Invalid email.' }, 400);
    if (!db.newsletter.includes(email)) db.newsletter.push(email);
    await saveDb(env, db);
    return json({ ok: true });
  }

  if (method === 'POST' && pathname === '/api/contact') {
    const body = await readBody(request);
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const message = String(body.message || '').trim().slice(0, 3000);
    const kind = body.kind ? String(body.kind).slice(0, 20) : '';
    const mobile = cleanMobile(body.mobile);
    const ratingN = Number(body.rating);
    const rating = ratingN >= 1 && ratingN <= 5 ? Math.round(ratingN) : undefined;
    const page = body.page ? String(body.page).slice(0, 120) : undefined;
    if (!name || !email || !message) return json({ error: 'All fields required.' }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return json({ error: 'Please enter a valid email.' }, 400);
    if (kind && !mobile) return json({ error: 'Please enter a valid 10-digit mobile number.' }, 400);
    if (message.length < 10) return json({ error: 'Please write at least 10 characters.' }, 400);
    const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').replace(/\n— page:.*$/, '').trim();
    if (db.messages.some((m) => m.email === email && norm(m.message) === norm(message))) return json({ error: 'You have already sent this same message. Please write something new.' }, 400);
    const hourAgo = Date.now() - 3600_000;
    if (db.messages.filter((m) => m.email === email && Date.parse(m.date) > hourAgo).length >= 5) return json({ error: 'Too many messages. Please try again after an hour.' }, 400);
    const id = (kind ? 'FB-' : 'MSG-') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    const msg: ContactMessage = { id, name, email, message, date: new Date().toISOString(), mobile: mobile || undefined, kind: kind || undefined, rating, page };
    db.messages.unshift(msg);
    await saveDb(env, db);
    const alert = sendFeedbackAlert(env, msg);
    if (typeof context.waitUntil === 'function') context.waitUntil(alert);
    else await alert;
    return json({ ok: true, id });
  }

  if (method === 'GET' && pathname === '/api/admin/export') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    return json({
      siteConfig: db.siteConfig,
      assets: db.assets,
      deletedSeed: db.deletedSeed,
      orders: db.orders,
      payouts: db.payouts,
      newsletter: db.newsletter,
      messages: db.messages,
    });
  }

  /* ================= GITHUB + AUTO-UPDATE SOURCE ZIP ================= */
  if (method === 'GET' && pathname === '/api/admin/source-zip') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const snapshot = buildLiveSnapshotPayload(db.siteConfig, db.assets, db.deletedSeed);
    const zipBytes = buildZip([
      { path: 'santalstock-update/src/data/liveSnapshot.json', data: JSON.stringify(snapshot, null, 2) + '\n' },
      { path: 'santalstock-update/.github/workflows/cloudflare-pages.yml', data: CLOUDFLARE_WORKFLOW_YML },
      { path: 'santalstock-update/.node-version', data: '22\n' },
      { path: 'santalstock-update/public/_headers', data: HEADERS_CONTENT },
      {
        path: 'santalstock-update/README-UPDATE.txt',
        data:
          'SantalStock Auto-Update Package\n' +
          '===============================\n' +
          'Extract these files into your SantalStock GitHub repository root and push to main.\n' +
          'Cloudflare Pages will automatically rebuild with all your live Admin Mode colors, prices, sections, and photos!\n',
      },
    ]);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
    return new Response(zipBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="santalstock-live-update-${stamp}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (method === 'GET' && pathname === '/api/admin/github/status') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    return json({
      tokenConfigured: Boolean(env.GITHUB_TOKEN),
      fullSourceZipAvailable: false,
      config: db.githubSync,
    });
  }

  if (method === 'PUT' && pathname === '/api/admin/github/config') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const body = await readBody(request);
    const owner = String(body.owner || '').trim();
    const repo = String(body.repo || '').trim();
    const branch = String(body.branch || 'main').trim() || 'main';
    const autoSync = Boolean(body.autoSync);

    if (owner || repo) {
      const check = validateGitHubRepoConfig(owner, repo, branch);
      if (!check.ok) return json({ error: check.error }, 400);
      db.githubSync.owner = check.owner;
      db.githubSync.repo = check.repo;
      db.githubSync.branch = check.branch;
    } else {
      db.githubSync.owner = '';
      db.githubSync.repo = '';
      db.githubSync.branch = 'main';
    }
    db.githubSync.autoSync = autoSync;
    db.githubSync.lastError = '';
    await saveDb(env, db);
    return json({ config: db.githubSync, tokenConfigured: Boolean(env.GITHUB_TOKEN) });
  }

  if (method === 'POST' && pathname === '/api/admin/github/sync') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    if (!env.GITHUB_TOKEN) {
      return json(
        { error: 'Add GITHUB_TOKEN under Cloudflare Pages -> Settings -> Variables and Secrets first.' },
        400
      );
    }
    if (!db.githubSync.owner || !db.githubSync.repo) {
      return json({ error: 'Please save your GitHub username and repository name first.' }, 400);
    }
    try {
      const body = await readBody(request);
      const snapshot = buildLiveSnapshotPayload(db.siteConfig, db.assets, db.deletedSeed);
      const result = await pushLiveSnapshotToGitHub(
        env.GITHUB_TOKEN,
        db.githubSync,
        snapshot,
        'Cloudflare admin sync',
        Boolean(body.includeWorkflow)
      );
      db.githubSync.lastSyncedAt = result.syncedAt;
      db.githubSync.lastCommitSha = result.sha;
      db.githubSync.lastCommitUrl = result.htmlUrl;
      db.githubSync.lastError = '';
      await saveDb(env, db);
      return json({ ok: true, result, config: db.githubSync });
    } catch (err) {
      const msg = (err as Error).message || 'GitHub sync failed.';
      db.githubSync.lastError = msg;
      await saveDb(env, db);
      return json({ error: msg }, 502);
    }
  }

  if (method === 'GET' && pathname === '/api/admin/github/latest') {
    const u = getAuthUser(request, db);
    if (!u || u.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    if (!db.githubSync.owner || !db.githubSync.repo) {
      return json({ error: 'Please configure GitHub owner & repository first.' }, 400);
    }
    try {
      const commit = await fetchLatestGitHubCommit(db.githubSync, env.GITHUB_TOKEN);
      return json({ commit });
    } catch (err) {
      return json({ error: (err as Error).message || 'Could not check GitHub updates.' }, 502);
    }
  }

  return json({ error: 'API endpoint not found.' }, 404);
}
