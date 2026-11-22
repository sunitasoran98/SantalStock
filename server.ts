import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import dns from 'dns/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { BASE_SITE_CONFIG, DEFAULT_SITE_CONFIG, SEED_ASSETS } from './src/data/defaults';
import {
  buildLiveSnapshotPayload,
  fetchLatestGitHubCommit,
  pushLiveSnapshotToGitHub,
  validateGitHubRepoConfig,
} from './src/lib/githubSync';
import { buildZip, type ZipEntryInput } from './src/lib/zipBuilder';
import type { Asset, GitHubSyncConfig, Order, Payout, SiteConfig, User, UserRole } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'santalstock-db.json');
const OWNER_ADMIN_EMAILS = new Set(['admin@santalstock.in', 'sunitasoran98@gmail.com']);

interface StoredUser extends User {
  pwHash: string;
  pwSalt: string;
  otpCode?: string;
  otpExpires?: number;
  resetCode?: string;
  resetExpires?: number;
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
  messages: { id: string; name: string; email: string; message: string; date: string }[];
  siteConfig: SiteConfig;
  githubSync: GitHubSyncConfig;
}

function defaultGitHubSync(): GitHubSyncConfig {
  return {
    owner: String(process.env.GITHUB_OWNER || '').trim(),
    repo: String(process.env.GITHUB_REPO || '').trim(),
    branch: String(process.env.GITHUB_BRANCH || 'main').trim() || 'main',
    autoSync: false,
  };
}

function hashPassword(password: string, salt?: string) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
}

function makeOtp() {
  return String(crypto.randomInt(100000, 999999));
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

function createInitialDb(): Database {
  const adminPw = hashPassword('admin123');
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
    githubSync: defaultGitHubSync(),
  };
}

function loadDb(): Database {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as Partial<Database>;
      const init = createInitialDb();
      const db: Database = {
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
        githubSync: { ...defaultGitHubSync(), ...(parsed.githubSync || {}) },
      };
      return db;
    }
  } catch (err) {
    console.error('Failed to load DB, initializing fresh store:', err);
  }
  const fresh = createInitialDb();
  saveDb(fresh);
  return fresh;
}

function saveDb(db: Database) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist DB:', err);
  }
}

let DB = loadDb();

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'trashmail.com',
  'fakeinbox.com',
]);

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
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 2500)),
    ]);
    if (!mx || mx.length === 0) {
      return { ok: false, error: `Email domain "${domain}" cannot receive emails. Please use a real email account (e.g., Gmail, Outlook).` };
    }
  } catch (err: unknown) {
    const code = (err as { code?: string; message?: string })?.code || (err as { message?: string })?.message;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      return { ok: false, error: `Email domain "${domain}" does not exist. Please enter a real email account.` };
    }
    // If DNS is blocked or times out in sandboxed network, allow syntactically valid non-disposable email
  }
  return { ok: true };
}

async function sendVerificationEmail(to: string, subject: string, code: string, purpose: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM || `SantalStock <${user || 'noreply@santalstock.in'}>`;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from,
        to,
        subject,
        text: `Your SantalStock ${purpose} code is: ${code}\n\nThis code expires in 15 minutes.`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
          <h2 style="margin:0 0 8px"><span style="color:#d6262f">SANTAL</span><span style="color:#0f766e">STOCK</span></h2>
          <p style="color:#334155">Your ${purpose} verification code is:</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#011f43;background:#f1f5f9;padding:16px;text-align:center;border-radius:8px;margin:16px 0">${code}</div>
          <p style="color:#64748b;font-size:13px">This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>`,
      });
      return { sentViaSmtp: true };
    } catch (err) {
      console.error('SMTP delivery error, falling back to in-app verification preview:', err);
    }
  }
  return { sentViaSmtp: false };
}

function getAuthUser(req: express.Request): StoredUser | null {
  const authHeader = req.headers.authorization || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)ss_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return null;
  const sess = DB.sessions.find((s) => s.token === token);
  if (!sess) return null;
  return DB.users.find((u) => u.email === sess.email) || null;
}

function createSession(res: express.Response, email: string) {
  const token = crypto.randomBytes(32).toString('hex');
  DB.sessions = DB.sessions.filter((s) => Date.now() - s.createdAt < 30 * 24 * 60 * 60 * 1000);
  DB.sessions.push({ token, email, createdAt: Date.now() });
  saveDb(DB);
  res.setHeader(
    'Set-Cookie',
    `ss_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${30 * 24 * 60 * 60}`
  );
  return token;
}

function getCatalog(user: StoredUser | null): Asset[] {
  const ovIds = new Set(DB.assets.map((a) => a.id));
  const delIds = new Set(DB.deletedSeed);
  const seeds = SEED_ASSETS.filter((a) => !ovIds.has(a.id) && !delIds.has(a.id));
  const all = [...DB.assets, ...seeds];
  if (user?.role === 'admin') return all;
  return all.filter((a) => a.status === 'approved' || (user && a.owner === user.email));
}

function licKey() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'SSL-';
  for (let i = 0; i < 12; i++) {
    s += c[crypto.randomInt(0, c.length)];
    if (i % 4 === 3 && i < 11) s += '-';
  }
  return s;
}

const ZIP_IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'data', '.aistudio', '.wrangler']);
const ZIP_IGNORED_FILES = new Set(['.env', '.env.local', '.env.production', '.env.development', '.DS_Store', 'bun.lock', 'bun.lockb']);

function collectWorkspaceZipEntries(): ZipEntryInput[] {
  const rootDir = path.resolve(__dirname);
  const entries: ZipEntryInput[] = [];
  const snapshotPayload = buildLiveSnapshotPayload(DB.siteConfig, DB.assets, DB.deletedSeed);
  const snapshotJson = JSON.stringify(snapshotPayload, null, 2) + '\n';

  function walk(currentDir: string) {
    const dirents = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const d of dirents) {
      const fullPath = path.resolve(currentDir, d.name);
      if (!fullPath.startsWith(rootDir + path.sep)) continue;
      if (d.isSymbolicLink()) continue;

      const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
      if (d.isDirectory()) {
        if (ZIP_IGNORED_DIRS.has(d.name) || relPath === 'public/assets/aistudio') continue;
        walk(fullPath);
      } else if (d.isFile()) {
        if (ZIP_IGNORED_FILES.has(d.name) || (d.name.startsWith('.env.') && d.name !== '.env.example')) continue;
        if (relPath === 'src/data/liveSnapshot.json') {
          entries.push({ path: `santalstock/${relPath}`, data: snapshotJson });
        } else {
          const stat = fs.statSync(fullPath);
          if (stat.size <= 15 * 1024 * 1024) {
            entries.push({ path: `santalstock/${relPath}`, data: new Uint8Array(fs.readFileSync(fullPath)) });
          }
        }
      }
    }
  }

  walk(rootDir);

  if (!entries.some((e) => e.path === 'santalstock/src/data/liveSnapshot.json')) {
    entries.push({ path: 'santalstock/src/data/liveSnapshot.json', data: snapshotJson });
  }
  return entries;
}

function triggerAutoGitHubSync(reason: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !DB.githubSync.autoSync || !DB.githubSync.owner || !DB.githubSync.repo) return;
  const snapshot = buildLiveSnapshotPayload(DB.siteConfig, DB.assets, DB.deletedSeed);
  pushLiveSnapshotToGitHub(token, DB.githubSync, snapshot, reason, false)
    .then((res) => {
      DB.githubSync.lastSyncedAt = res.syncedAt;
      DB.githubSync.lastCommitSha = res.sha;
      DB.githubSync.lastCommitUrl = res.htmlUrl;
      DB.githubSync.lastError = '';
      saveDb(DB);
    })
    .catch((err: unknown) => {
      DB.githubSync.lastError = (err as Error)?.message || 'Auto-sync failed';
      saveDb(DB);
    });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  /* ================= AUTH ROUTES ================= */
  app.get('/api/auth/me', (req, res) => {
    const u = getAuthUser(req);
    res.json({ user: u ? sanitizeUser(u) : null, smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { name, email: rawEmail, password, role } = req.body || {};
    const email = String(rawEmail || '').trim().toLowerCase();
    const cleanName = String(name || '').trim();
    const pw = String(password || '');

    if (!cleanName || cleanName.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
    if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const check = await validateRealEmail(email);
    if (!check.ok) return res.status(400).json({ error: check.error });

    const existing = DB.users.find((u) => u.email === email);
    if (existing && existing.emailVerified) {
      return res.status(400).json({ error: 'This email is already registered. Please sign in.' });
    }

    const { hash, salt } = hashPassword(pw);
    const otpCode = makeOtp();
    const otpExpires = Date.now() + 15 * 60 * 1000;
    const assignedRole: UserRole = OWNER_ADMIN_EMAILS.has(email)
      ? 'admin'
      : role === 'contributor'
      ? 'contributor'
      : 'buyer';

    if (existing) {
      existing.name = cleanName;
      existing.pwHash = hash;
      existing.pwSalt = salt;
      existing.role = assignedRole;
      existing.otpCode = otpCode;
      existing.otpExpires = otpExpires;
    } else {
      DB.users.push({
        email,
        name: cleanName,
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
    saveDb(DB);

    const delivery = await sendVerificationEmail(email, 'Verify your SantalStock email', otpCode, 'email verification');
    res.json({
      verificationRequired: true,
      email,
      sentViaSmtp: delivery.sentViaSmtp,
      previewCode: delivery.sentViaSmtp ? undefined : otpCode,
      message: delivery.sentViaSmtp
        ? `Verification code sent to ${email}. Check your inbox.`
        : `Verification code generated for ${email}.`,
    });
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const { email: rawEmail, code } = req.body || {};
    const email = String(rawEmail || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const u = DB.users.find((x) => x.email === email);
    if (!u) return res.status(404).json({ error: 'Account not found.' });
    if (!u.otpCode || u.otpCode !== cleanCode) return res.status(400).json({ error: 'Invalid verification code.' });
    if (u.otpExpires && Date.now() > u.otpExpires) return res.status(400).json({ error: 'Verification code expired. Please resend.' });

    u.emailVerified = true;
    u.otpCode = undefined;
    u.otpExpires = undefined;
    if (OWNER_ADMIN_EMAILS.has(u.email)) u.role = 'admin';
    saveDb(DB);

    const token = createSession(res, u.email);
    res.json({ user: sanitizeUser(u), token });
  });

  app.post('/api/auth/resend-otp', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const u = DB.users.find((x) => x.email === email);
    if (!u) return res.status(404).json({ error: 'Account not found.' });
    const otpCode = makeOtp();
    u.otpCode = otpCode;
    u.otpExpires = Date.now() + 15 * 60 * 1000;
    saveDb(DB);

    const delivery = await sendVerificationEmail(email, 'Your new SantalStock verification code', otpCode, 'email verification');
    res.json({
      sentViaSmtp: delivery.sentViaSmtp,
      previewCode: delivery.sentViaSmtp ? undefined : otpCode,
      message: delivery.sentViaSmtp ? `New code sent to ${email}.` : 'New verification code generated.',
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const u = DB.users.find((x) => x.email === email);
    if (!u || !verifyPassword(password, u.pwHash, u.pwSalt)) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (!u.emailVerified) {
      const otpCode = makeOtp();
      u.otpCode = otpCode;
      u.otpExpires = Date.now() + 15 * 60 * 1000;
      saveDb(DB);
      const delivery = await sendVerificationEmail(email, 'Verify your SantalStock email', otpCode, 'email verification');
      return res.status(200).json({
        verificationRequired: true,
        email,
        sentViaSmtp: delivery.sentViaSmtp,
        previewCode: delivery.sentViaSmtp ? undefined : otpCode,
        message: 'Please verify your email address before signing in.',
      });
    }
    if (OWNER_ADMIN_EMAILS.has(u.email) && u.role !== 'admin') {
      u.role = 'admin';
      saveDb(DB);
    }
    const token = createSession(res, u.email);
    res.json({ user: sanitizeUser(u), token });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const u = DB.users.find((x) => x.email === email);
    if (!u) return res.status(404).json({ error: 'No account found with this email.' });
    const resetCode = makeOtp();
    u.resetCode = resetCode;
    u.resetExpires = Date.now() + 15 * 60 * 1000;
    saveDb(DB);

    const delivery = await sendVerificationEmail(email, 'SantalStock Password Reset Code', resetCode, 'password reset');
    res.json({
      ok: true,
      email,
      sentViaSmtp: delivery.sentViaSmtp,
      previewCode: delivery.sentViaSmtp ? undefined : resetCode,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const u = DB.users.find((x) => x.email === email);
    if (!u || !u.resetCode || u.resetCode !== code) return res.status(400).json({ error: 'Invalid reset code.' });
    if (u.resetExpires && Date.now() > u.resetExpires) return res.status(400).json({ error: 'Reset code expired.' });

    const { hash, salt } = hashPassword(newPassword);
    u.pwHash = hash;
    u.pwSalt = salt;
    u.emailVerified = true;
    u.resetCode = undefined;
    u.resetExpires = undefined;
    saveDb(DB);
    const token = createSession(res, u.email);
    res.json({ user: sanitizeUser(u), token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token && req.headers.cookie) {
      const m = req.headers.cookie.match(/(?:^|;\s*)ss_session=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }
    if (token) {
      DB.sessions = DB.sessions.filter((s) => s.token !== token);
      saveDb(DB);
    }
    res.setHeader('Set-Cookie', 'ss_session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0');
    res.json({ ok: true });
  });

  app.put('/api/auth/profile', (req, res) => {
    const u = getAuthUser(req);
    if (!u) return res.status(401).json({ error: 'Sign in required.' });
    const { name, company, gstin, state, pin, role, plan } = req.body || {};
    if (typeof name === 'string' && name.trim()) u.name = name.trim();
    if (typeof company === 'string') u.company = company.trim();
    if (typeof gstin === 'string') u.gstin = gstin.trim();
    if (typeof state === 'string') u.state = state.trim();
    if (typeof pin === 'string') u.pin = pin.trim();
    if (u.role !== 'admin' && (role === 'buyer' || role === 'contributor')) u.role = role;
    if (plan === null) u.plan = null;
    saveDb(DB);
    res.json({ user: sanitizeUser(u) });
  });

  /* ================= STATE & CMS ================= */
  app.get('/api/state', (req, res) => {
    const u = getAuthUser(req);
    const assets = getCatalog(u);
    const orders = u
      ? u.role === 'admin'
        ? DB.orders
        : DB.orders.filter((o) => o.user === u.email || o.items.some((i) => i.owner === u.email))
      : [];
    const payouts = u
      ? u.role === 'admin'
        ? DB.payouts
        : DB.payouts.filter((p) => p.user === u.email)
      : [];
    const users = u?.role === 'admin' ? DB.users.map(sanitizeUser) : [];
    const lightbox = u ? DB.lightbox[u.email] || { Favorites: [] } : null;

    // Public download count per asset
    const dlCounts: Record<string, number> = {};
    for (const o of DB.orders) {
      for (const i of o.items) {
        dlCounts[i.id] = (dlCounts[i.id] || 0) + 1;
      }
    }

    res.json({
      user: u ? sanitizeUser(u) : null,
      siteConfig: DB.siteConfig,
      assets,
      orders,
      payouts,
      users,
      lightbox,
      dlCounts,
      messages: u?.role === 'admin' ? DB.messages : [],
    });
  });

  app.put('/api/cms', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    DB.siteConfig = deepMergeConfig(req.body?.siteConfig);
    saveDb(DB);
    triggerAutoGitHubSync('CMS visual update');
    res.json({ siteConfig: DB.siteConfig });
  });

  app.post('/api/cms/reset', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    DB.siteConfig = structuredClone(BASE_SITE_CONFIG);
    saveDb(DB);
    triggerAutoGitHubSync('CMS reset to defaults');
    res.json({ siteConfig: DB.siteConfig });
  });

  /* ================= ASSETS CRUD ================= */
  app.post('/api/assets', (req, res) => {
    const u = getAuthUser(req);
    if (!u || !['contributor', 'admin'].includes(u.role)) {
      return res.status(403).json({ error: 'Contributor or Admin account required.' });
    }
    const b = req.body || {};
    const id = 'SS' + (5000 + DB.assets.length + crypto.randomInt(100, 99999));
    let owner = u.email;
    let contributor = u.name;
    if (u.role === 'admin' && b.assignOwner) {
      const au = DB.users.find((x) => x.email === b.assignOwner);
      if (au) {
        owner = au.email;
        contributor = au.name;
      }
    }
    const asset: Asset = {
      id,
      title: String(b.title || 'Untitled Photo').trim().slice(0, 120),
      desc: String(b.desc || '').trim(),
      kw: Array.isArray(b.kw) ? b.kw.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean) : [],
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
      prevUrl: String(b.prevUrl || ''),
      fullUrl: String(b.fullUrl || b.prevUrl || ''),
    };
    DB.assets.unshift(asset);
    saveDb(DB);
    if (u.role === 'admin') triggerAutoGitHubSync(`Add photo ${asset.id}`);
    res.json({ asset });
  });

  app.put('/api/assets/:id', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    const id = req.params.id;
    const b = req.body || {};
    let rec = DB.assets.find((x) => x.id === id);
    if (!rec) {
      const seed = SEED_ASSETS.find((x) => x.id === id);
      if (!seed) return res.status(404).json({ error: 'Photo not found.' });
      rec = { ...seed };
      DB.assets.unshift(rec);
    }
    if (typeof b.title === 'string') rec.title = b.title.trim();
    if (typeof b.desc === 'string') rec.desc = b.desc.trim();
    if (typeof b.contributor === 'string') rec.contributor = b.contributor.trim();
    if (typeof b.owner === 'string') rec.owner = b.owner;
    if (typeof b.cat === 'string') rec.cat = b.cat.trim();
    if (b.lic === 'rf' || b.lic === 'editorial') rec.lic = b.lic;
    if (b.status === 'approved' || b.status === 'pending' || b.status === 'rejected') rec.status = b.status;
    if (typeof b.place === 'string') rec.place = b.place.trim();
    if (typeof b.caption === 'string') rec.caption = b.caption.trim();
    if (typeof b.reason === 'string') rec.reason = b.reason.trim();
    if (Array.isArray(b.kw)) rec.kw = b.kw.map((k: string) => String(k).trim().toLowerCase()).filter(Boolean);
    if (b.prevUrl) {
      rec.prevUrl = String(b.prevUrl);
      rec.fullUrl = String(b.fullUrl || b.prevUrl);
      rec.w = Number(b.w) || rec.w;
      rec.h = Number(b.h) || rec.h;
      rec.src = 'upload';
      delete rec.pid;
    }
    saveDb(DB);
    triggerAutoGitHubSync(`Update photo ${rec.id}`);
    res.json({ asset: rec });
  });

  app.delete('/api/assets/:id', (req, res) => {
    const u = getAuthUser(req);
    if (!u) return res.status(401).json({ error: 'Sign in required.' });
    const id = req.params.id;
    const rec = DB.assets.find((x) => x.id === id);
    const isSeed = SEED_ASSETS.some((x) => x.id === id);
    if (u.role !== 'admin' && (!rec || rec.owner !== u.email)) {
      return res.status(403).json({ error: 'Not allowed to delete this photo.' });
    }
    if (isSeed && !DB.deletedSeed.includes(id)) DB.deletedSeed.push(id);
    DB.assets = DB.assets.filter((x) => x.id !== id);
    saveDb(DB);
    if (u.role === 'admin') triggerAutoGitHubSync(`Delete photo ${id}`);
    res.json({ ok: true });
  });

  /* ================= ORDERS & VERIFY ================= */
  app.post('/api/orders', (req, res) => {
    const u = getAuthUser(req);
    if (!u) return res.status(401).json({ error: 'Sign in required.' });
    const { kind, bill, pay, items: reqItems, licensee, use } = req.body || {};
    const pricing = DB.siteConfig.pricing;

    u.company = String(bill?.company || u.company || '');
    u.gstin = String(bill?.gstin || u.gstin || '');
    u.state = String(bill?.state || u.state || 'Jharkhand');
    u.pin = String(bill?.pin || u.pin || '');

    const oid = 'SS-ORD-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
    const order: Order = {
      id: oid,
      date: new Date().toISOString(),
      user: u.email,
      bill: {
        name: String(bill?.name || u.name),
        email: String(bill?.email || u.email),
        company: u.company,
        gstin: u.gstin,
        state: u.state,
        pin: u.pin,
      },
      pay: pay === 'credits' || pay === 'card' ? pay : 'upi',
      type: kind === 'cart' ? 'license' : 'credits',
      sub: 0,
      gst: 0,
      total: 0,
      items: [],
    };

    if (kind === 'cart') {
      const catalog = getCatalog(u);
      const validItems = (Array.isArray(reqItems) ? reqItems : [])
        .map((c: { id: string; lic: 'std' | 'ext' | 'ed'; size: 'S' | 'M' | 'L' }) => {
          const a = catalog.find((x) => x.id === c.id);
          if (!a) return null;
          const unitPrice = pricing.matrix[c.lic]?.[c.size] ?? 19;
          return { ...c, price: unitPrice, asset: a };
        })
        .filter(Boolean) as { id: string; lic: 'std' | 'ext' | 'ed'; size: 'S' | 'M' | 'L'; price: number; asset: Asset }[];

      if (!validItems.length) return res.status(400).json({ error: 'Cart is empty.' });

      const sub = validItems.reduce((n, i) => n + i.price, 0);
      const gst = Math.round(sub * pricing.gst);
      const crNeed = validItems.reduce((n, i) => n + (pricing.licMeta[i.lic]?.cr || 1), 0);

      if (order.pay === 'credits') {
        if ((u.credits || 0) < crNeed) return res.status(400).json({ error: 'Insufficient credits.' });
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
        royalty: Math.round((order.pay === 'credits' ? c.price * 0.6 : c.price) * (c.asset.lic === 'editorial' ? pricing.royalty.editorial : pricing.royalty.rf)),
      }));
    } else if (typeof kind === 'string' && kind.startsWith('plan:')) {
      const v = kind.slice(5);
      const P = pricing.plans.find((x) => x.id === v);
      if (!P) return res.status(404).json({ error: 'Plan not found.' });
      const gst = Math.round(P.p * pricing.gst);
      order.sub = P.p;
      order.gst = gst;
      order.total = P.p + gst;
      order.desc = `${P.n} plan`;
      order.addCr = P.cr;
      u.credits = (u.credits || 0) + P.cr;
      u.plan = { id: P.id, since: order.date };
    } else if (typeof kind === 'string' && kind.startsWith('pack:')) {
      const v = kind.slice(5);
      const P = pricing.packs.find((x) => x.id === v) || pricing.packs[Number(v)];
      if (!P) return res.status(404).json({ error: 'Pack not found.' });
      const gst = Math.round(P.p * pricing.gst);
      order.sub = P.p;
      order.gst = gst;
      order.total = P.p + gst;
      order.desc = `${P.cr} credit pack`;
      order.addCr = P.cr;
      u.credits = (u.credits || 0) + P.cr;
    } else {
      return res.status(400).json({ error: 'Invalid order type.' });
    }

    DB.orders.unshift(order);
    saveDb(DB);
    res.json({ order, user: sanitizeUser(u) });
  });

  app.get('/api/verify-license', (req, res) => {
    const key = String(req.query.k || '').trim().toUpperCase();
    if (!key) return res.json({ valid: false });
    for (const o of DB.orders) {
      for (const i of o.items) {
        if (i.key.toUpperCase() === key) {
          return res.json({
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
    res.json({ valid: false });
  });

  /* ================= PAYOUTS, USERS, LIGHTBOX, MISC ================= */
  app.post('/api/payouts', (req, res) => {
    const u = getAuthUser(req);
    if (!u || !['contributor', 'admin'].includes(u.role)) return res.status(403).json({ error: 'Contributor access required.' });
    const upi = String(req.body?.upi || '').trim();
    const pan = String(req.body?.pan || '').trim().toUpperCase();
    if (!upi) return res.status(400).json({ error: 'UPI ID required.' });
    u.payout = { upi, pan };

    const earned = DB.orders.flatMap((o) => o.items.filter((i) => i.owner === u.email)).reduce((n, s) => n + s.royalty, 0);
    const paid = DB.payouts.filter((p) => p.user === u.email).reduce((n, p) => n + p.amt, 0);
    const bal = earned - paid;
    if (bal < DB.siteConfig.pricing.payoutMin) {
      return res.status(400).json({ error: `Minimum payout balance is ${DB.siteConfig.pricing.currency}${DB.siteConfig.pricing.payoutMin}.` });
    }
    const payout: Payout = {
      id: 'PO' + Date.now().toString(36).toUpperCase(),
      user: u.email,
      amt: bal,
      upi,
      date: new Date().toISOString(),
      status: 'requested',
    };
    DB.payouts.unshift(payout);
    saveDb(DB);
    res.json({ payout });
  });

  app.put('/api/payouts/:id/pay', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    const p = DB.payouts.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Payout not found.' });
    p.status = 'paid';
    saveDb(DB);
    res.json({ payout: p });
  });

  app.put('/api/users/:email/role', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    const target = DB.users.find((x) => x.email === req.params.email.toLowerCase());
    if (!target) return res.status(404).json({ error: 'User not found.' });
    const role = req.body?.role;
    if (!['buyer', 'contributor', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    target.role = role;
    saveDb(DB);
    res.json({ user: sanitizeUser(target) });
  });

  app.put('/api/lightbox', (req, res) => {
    const u = getAuthUser(req);
    if (!u) return res.status(401).json({ error: 'Sign in required.' });
    if (req.body?.lightbox && typeof req.body.lightbox === 'object') {
      DB.lightbox[u.email] = req.body.lightbox;
      saveDb(DB);
    }
    res.json({ lightbox: DB.lightbox[u.email] || { Favorites: [] } });
  });

  app.post('/api/newsletter', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
    if (!DB.newsletter.includes(email)) DB.newsletter.push(email);
    saveDb(DB);
    res.json({ ok: true });
  });

  app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: 'All fields required.' });
    DB.messages.unshift({
      id: 'MSG-' + Date.now().toString(36).toUpperCase(),
      name: String(name).trim(),
      email: String(email).trim(),
      message: String(message).trim(),
      date: new Date().toISOString(),
    });
    saveDb(DB);
    res.json({ ok: true });
  });

  app.get('/api/admin/export', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    res.json({
      siteConfig: DB.siteConfig,
      assets: DB.assets,
      deletedSeed: DB.deletedSeed,
      orders: DB.orders,
      payouts: DB.payouts,
      newsletter: DB.newsletter,
      messages: DB.messages,
    });
  });

  /* ================= GITHUB + AUTO-UPDATE SOURCE ZIP ================= */
  app.get('/api/admin/source-zip', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    try {
      const entries = collectWorkspaceZipEntries();
      const zipBytes = buildZip(entries);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="santalstock-source-${stamp}.zip"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(Buffer.from(zipBytes));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message || 'Failed to build source ZIP.' });
    }
  });

  app.get('/api/admin/github/status', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    res.json({
      tokenConfigured: Boolean(process.env.GITHUB_TOKEN),
      fullSourceZipAvailable: true,
      config: DB.githubSync,
    });
  });

  app.put('/api/admin/github/config', (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    const owner = String(req.body?.owner || '').trim();
    const repo = String(req.body?.repo || '').trim();
    const branch = String(req.body?.branch || 'main').trim() || 'main';
    const autoSync = Boolean(req.body?.autoSync);

    if (owner || repo) {
      const check = validateGitHubRepoConfig(owner, repo, branch);
      if (!check.ok) return res.status(400).json({ error: check.error });
      DB.githubSync.owner = check.owner;
      DB.githubSync.repo = check.repo;
      DB.githubSync.branch = check.branch;
    } else {
      DB.githubSync.owner = '';
      DB.githubSync.repo = '';
      DB.githubSync.branch = 'main';
    }
    DB.githubSync.autoSync = autoSync;
    DB.githubSync.lastError = '';
    saveDb(DB);
    res.json({ config: DB.githubSync, tokenConfigured: Boolean(process.env.GITHUB_TOKEN) });
  });

  app.post('/api/admin/github/sync', async (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(400).json({
        error: 'GITHUB_TOKEN is not configured in server Secrets / Environment Variables yet.',
      });
    }
    if (!DB.githubSync.owner || !DB.githubSync.repo) {
      return res.status(400).json({ error: 'Please save your GitHub username and repository name first.' });
    }
    try {
      const includeWorkflow = Boolean(req.body?.includeWorkflow);
      const snapshot = buildLiveSnapshotPayload(DB.siteConfig, DB.assets, DB.deletedSeed);
      const result = await pushLiveSnapshotToGitHub(
        token,
        DB.githubSync,
        snapshot,
        'Manual admin sync',
        includeWorkflow
      );
      DB.githubSync.lastSyncedAt = result.syncedAt;
      DB.githubSync.lastCommitSha = result.sha;
      DB.githubSync.lastCommitUrl = result.htmlUrl;
      DB.githubSync.lastError = '';
      saveDb(DB);
      res.json({ ok: true, result, config: DB.githubSync });
    } catch (err) {
      const msg = (err as Error).message || 'GitHub sync failed.';
      DB.githubSync.lastError = msg;
      saveDb(DB);
      res.status(502).json({ error: msg });
    }
  });

  app.get('/api/admin/github/latest', async (req, res) => {
    const u = getAuthUser(req);
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
    if (!DB.githubSync.owner || !DB.githubSync.repo) {
      return res.status(400).json({ error: 'Please configure GitHub owner & repository first.' });
    }
    try {
      const commit = await fetchLatestGitHubCommit(DB.githubSync, process.env.GITHUB_TOKEN);
      res.json({ commit });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message || 'Could not check GitHub updates.' });
    }
  });

  /* ================= VITE / STATIC SERVING ================= */
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SantalStock server listening on http://localhost:${PORT}`);
  });
}

startServer();
