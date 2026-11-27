import { DEFAULT_SITE_CONFIG, SEED_ASSETS } from '../data/defaults';
import {
  buildLiveSnapshotPayload,
  CLOUDFLARE_WORKFLOW_YML,
  fetchLatestGitHubCommit,
  HEADERS_CONTENT,
  validateGitHubRepoConfig,
} from './githubSync';
import { buildZip } from './zipBuilder';
import { cleanFingerprint, findDuplicates } from './dupMatch';
import type { Asset, ContactMessage, GitHubSyncConfig, Order, Payout, SiteConfig, User, UserRole } from '../types';

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
}

interface SessionRecord {
  token: string;
  email: string;
  createdAt: number;
}

interface LocalDatabase {
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
  githubSync?: GitHubSyncConfig;
}

const STORAGE_KEY = 'santalstock_static_db_v1';
const OWNER_ADMIN_EMAILS = new Set(['admin@santalstock.in', 'sunitasoran98@gmail.com']);
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'yopmail.com',
  'trashmail.com',
  'fakeinbox.com',
]);

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
    { name: 'PBKDF2', salt: enc.encode(s), iterations: 60000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: toHex(new Uint8Array(bits)), salt: s };
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const derived = await hashPassword(password, salt);
  return derived.hash === hash;
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

async function loadLocalDb(): Promise<LocalDatabase> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalDatabase>;
      if (parsed.users?.length) {
        return {
          users: parsed.users,
          sessions: parsed.sessions || [],
          assets: parsed.assets || [],
          deletedSeed: parsed.deletedSeed || [],
          orders: parsed.orders || [],
          payouts: parsed.payouts || [],
          lightbox: parsed.lightbox || {},
          newsletter: parsed.newsletter || [],
          messages: parsed.messages || [],
          siteConfig: deepMergeConfig(parsed.siteConfig),
          githubSync: parsed.githubSync || { owner: '', repo: '', branch: 'main', autoSync: false },
        };
      }
    }
  } catch {
    // initialize fresh store
  }

  const adminPw = await hashPassword('admin123');
  const fresh: LocalDatabase = {
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
  };
  saveLocalDb(fresh);
  return fresh;
}

function saveLocalDb(db: LocalDatabase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

async function validateRealEmail(email: string): Promise<{ ok: boolean; error?: string }> {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  const domain = email.split('@')[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, error: 'Temporary/disposable emails are not allowed. Please use a real email account.' };
  }
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { Accept: 'application/dns-json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { Status?: number; Answer?: unknown[] };
      if (data.Status === 3) {
        return { ok: false, error: `Email domain "${domain}" does not exist. Please enter a real email account.` };
      }
      if (data.Status === 0 && (!data.Answer || data.Answer.length === 0)) {
        return { ok: false, error: `Email domain "${domain}" cannot receive emails. Please use a real email account.` };
      }
    }
  } catch {
    // allow valid syntax if offline
  }
  return { ok: true };
}

function getCatalog(db: LocalDatabase, user: StoredUser | null): Asset[] {
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

export async function handleStaticFallback<T>(
  rawUrl: string,
  options: RequestInit,
  token: string
): Promise<T> {
  const db = await loadLocalDb();
  const method = (options.method || 'GET').toUpperCase();
  const parsedUrl = new URL(rawUrl, window.location.origin);
  const pathname = parsedUrl.pathname.replace(/\/+$/, '');
  const body: Record<string, unknown> = options.body
    ? (JSON.parse(String(options.body)) as Record<string, unknown>)
    : {};

  const getAuth = (): StoredUser | null => {
    if (!token) return null;
    const sess = db.sessions.find((s) => s.token === token);
    if (!sess) return null;
    return db.users.find((u) => u.email === sess.email) || null;
  };

  const makeSession = (email: string) => {
    const tok = randomHex(24);
    db.sessions.push({ token: tok, email, createdAt: Date.now() });
    saveLocalDb(db);
    return tok;
  };

  if (method === 'GET' && pathname === '/api/auth/me') {
    const u = getAuth();
    return { user: u ? sanitizeUser(u) : null, smtpConfigured: false } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    const email = String(body.email || '').trim().toLowerCase();
    const cleanName = String(body.name || '').trim();
    const pw = String(body.password || '');
    const mobile = cleanMobile(body.mobile);
    if (!cleanName || cleanName.length < 2) throw new Error('Please enter your full name.');
    if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
    if (!mobile) throw new Error('Please enter a valid 10-digit mobile number.');
    if (body.role === 'admin' && !OWNER_ADMIN_EMAILS.has(email)) throw new Error('Only the owner email can set up Admin. Please login as Buyer or Contributor.');
    const check = await validateRealEmail(email);
    if (!check.ok) throw new Error(check.error || 'Invalid email.');

    const existing = db.users.find((u) => u.email === email);
    if (existing && existing.emailVerified) {
      throw new Error('This email is already registered. Please login, or use Forgot password.');
    }
    const { hash, salt } = await hashPassword(pw);
    const otpCode = makeOtp();
    const otpExpires = Date.now() + 15 * 60 * 1000;
    const assignedRole: UserRole = OWNER_ADMIN_EMAILS.has(email)
      ? 'admin'
      : body.role === 'contributor'
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
    saveLocalDb(db);
    return {
      verificationRequired: true,
      email,
      sentViaSmtp: false,
      previewCode: otpCode,
      message: `Verification code generated for ${email}.`,
    } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/verify-email') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const u = db.users.find((x) => x.email === email);
    if (!u) throw new Error('Account not found.');
    if (!u.otpCode || u.otpCode !== code) throw new Error('Invalid verification code.');
    u.emailVerified = true;
    u.otpCode = undefined;
    u.otpExpires = undefined;
    if (OWNER_ADMIN_EMAILS.has(u.email)) u.role = 'admin';
    const tok = makeSession(u.email);
    return { user: sanitizeUser(u), token: tok } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/resend-otp') {
    const email = String(body.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email);
    if (!u) throw new Error('Account not found.');
    const otpCode = makeOtp();
    u.otpCode = otpCode;
    u.otpExpires = Date.now() + 15 * 60 * 1000;
    saveLocalDb(db);
    return { sentViaSmtp: false, previewCode: otpCode, message: 'New verification code generated.' } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const u = db.users.find((x) => x.email === email);
    if (!u || !(await verifyPassword(password, u.pwHash, u.pwSalt))) {
      throw new Error('Incorrect email or password.');
    }
    if (!u.emailVerified) {
      const otpCode = makeOtp();
      u.otpCode = otpCode;
      u.otpExpires = Date.now() + 15 * 60 * 1000;
      saveLocalDb(db);
      return {
        verificationRequired: true,
        email,
        sentViaSmtp: false,
        previewCode: otpCode,
        message: 'Please verify your email address before signing in.',
      } as T;
    }
    if (OWNER_ADMIN_EMAILS.has(u.email)) u.role = 'admin';
    const tok = makeSession(u.email);
    return { user: sanitizeUser(u), token: tok } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/forgot-password') {
    const email = String(body.email || '').trim().toLowerCase();
    const u = db.users.find((x) => x.email === email);
    if (!u) throw new Error('No account found with this email.');
    const resetCode = makeOtp();
    u.resetCode = resetCode;
    u.resetExpires = Date.now() + 15 * 60 * 1000;
    saveLocalDb(db);
    return { ok: true, email, sentViaSmtp: false, previewCode: resetCode } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/reset-password') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    const u = db.users.find((x) => x.email === email);
    if (!u || !u.resetCode || u.resetCode !== code) throw new Error('Invalid reset code.');
    const { hash, salt } = await hashPassword(newPassword);
    u.pwHash = hash;
    u.pwSalt = salt;
    u.emailVerified = true;
    u.resetCode = undefined;
    u.resetExpires = undefined;
    const tok = makeSession(u.email);
    return { user: sanitizeUser(u), token: tok } as T;
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    db.sessions = db.sessions.filter((s) => s.token !== token);
    saveLocalDb(db);
    return { ok: true } as T;
  }

  if (method === 'PUT' && pathname === '/api/auth/profile') {
    const u = getAuth();
    if (!u) throw new Error('Sign in required.');
    if (typeof body.name === 'string' && body.name.trim()) u.name = body.name.trim();
    if (typeof body.company === 'string') u.company = body.company.trim();
    if (typeof body.gstin === 'string') u.gstin = body.gstin.trim();
    if (typeof body.state === 'string') u.state = body.state.trim();
    if (typeof body.pin === 'string') u.pin = body.pin.trim();
    if (u.role !== 'admin' && (body.role === 'buyer' || body.role === 'contributor')) u.role = body.role;
    if (body.plan === null) u.plan = null;
    saveLocalDb(db);
    return { user: sanitizeUser(u) } as T;
  }

  if (method === 'GET' && pathname === '/api/state') {
    const u = getAuth();
    const dlCounts: Record<string, number> = {};
    for (const o of db.orders) {
      for (const i of o.items) dlCounts[i.id] = (dlCounts[i.id] || 0) + 1;
    }
    return {
      user: u ? sanitizeUser(u) : null,
      siteConfig: db.siteConfig,
      assets: getCatalog(db, u),
      orders: u
        ? u.role === 'admin'
          ? db.orders
          : db.orders.filter((o) => o.user === u.email || o.items.some((i) => i.owner === u.email))
        : [],
      payouts: u ? (u.role === 'admin' ? db.payouts : db.payouts.filter((p) => p.user === u.email)) : [],
      users: u?.role === 'admin' ? db.users.map(sanitizeUser) : [],
      lightbox: u ? db.lightbox[u.email] || { Favorites: [] } : null,
      dlCounts,
      messages: u?.role === 'admin' ? db.messages : [],
    } as T;
  }

  if (method === 'PUT' && pathname === '/api/cms') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    db.siteConfig = deepMergeConfig(body.siteConfig as Partial<SiteConfig> | undefined);
    saveLocalDb(db);
    return { siteConfig: db.siteConfig } as T;
  }

  if (method === 'POST' && pathname === '/api/cms/reset') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    db.siteConfig = structuredClone(DEFAULT_SITE_CONFIG);
    saveLocalDb(db);
    return { siteConfig: db.siteConfig } as T;
  }

  if (method === 'POST' && pathname === '/api/assets/check-duplicate') {
    const u = getAuth();
    if (!u || !['contributor', 'admin'].includes(u.role)) throw new Error('Contributor or Admin account required.');
    const hits = findDuplicates(cleanFingerprint(body), db.assets.filter((a) => a.status !== 'rejected'));
    return {
      matches: hits.map((h) => {
        const a = db.assets.find((x) => x.id === h.id)!;
        const visible = u.role === 'admin' || a.owner === u.email || a.status === 'approved';
        return { ...h, mine: a.owner === u.email, title: visible ? a.title : '', thumb: visible ? a.prevUrl || '' : '', status: a.status };
      }),
    } as T;
  }

  if (method === 'POST' && pathname === '/api/assets') {
    const u = getAuth();
    if (!u || !['contributor', 'admin'].includes(u.role)) throw new Error('Contributor or Admin account required.');
    const fp = cleanFingerprint(body);
    const dupHits = findDuplicates(fp, db.assets.filter((a) => a.status !== 'rejected'));
    const exactHit = dupHits.find((h) => h.kind === 'exact');
    if (exactHit && !(u.role === 'admin' && body.force === true)) {
      throw new Error(`Ye photo pehle se SantalStock par hai (${exactHit.id}). Duplicate upload allowed nahi hai.`);
    }
    const asset: Asset = {
      id: 'SS' + (5000 + db.assets.length + Math.floor(Math.random() * 90000)),
      title: String(body.title || 'Untitled Photo').trim().slice(0, 120),
      desc: String(body.desc || '').trim(),
      kw: Array.isArray(body.kw) ? body.kw.map((k) => String(k).trim().toLowerCase()).filter(Boolean) : [],
      cat: String(body.cat || 'Culture').trim(),
      lic: body.lic === 'editorial' ? 'editorial' : 'rf',
      w: Number(body.w) || 1600,
      h: Number(body.h) || 1067,
      dl: 0,
      date: new Date().toISOString().slice(0, 10),
      contributor: u.name,
      owner: u.email,
      status: u.role === 'admin' ? 'approved' : 'pending',
      src: 'upload',
      release: body.lic === 'editorial' ? 'na' : String(body.release || 'none'),
      relfile: String(body.relfile || ''),
      caption: String(body.caption || '').trim(),
      evdate: String(body.evdate || ''),
      place: String(body.place || '').trim(),
      prevUrl: String(body.prevUrl || ''),
      fullUrl: String(body.fullUrl || body.prevUrl || ''),
      ...fp.sha256 ? { sha256: fp.sha256 } : {},
      ...fp.phash ? { phash: fp.phash } : {},
      ...fp.dhash ? { dhash: fp.dhash } : {},
      ...dupHits.length ? { dup: dupHits } : {},
    };
    db.assets.unshift(asset);
    saveLocalDb(db);
    return { asset } as T;
  }

  const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
  if (assetMatch && method === 'PUT') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    const id = decodeURIComponent(assetMatch[1]);
    let rec = db.assets.find((x) => x.id === id);
    if (!rec) {
      const seed = SEED_ASSETS.find((x) => x.id === id);
      if (!seed) throw new Error('Photo not found.');
      rec = { ...seed };
      db.assets.unshift(rec);
    }
    if (typeof body.title === 'string') rec.title = body.title.trim();
    if (typeof body.desc === 'string') rec.desc = body.desc.trim();
    if (typeof body.contributor === 'string') rec.contributor = body.contributor.trim();
    if (typeof body.cat === 'string') rec.cat = body.cat.trim();
    if (body.lic === 'rf' || body.lic === 'editorial') rec.lic = body.lic;
    if (body.status === 'approved' || body.status === 'pending' || body.status === 'rejected') rec.status = body.status;
    if (typeof body.place === 'string') rec.place = body.place.trim();
    if (typeof body.caption === 'string') rec.caption = body.caption.trim();
    if (typeof body.reason === 'string') rec.reason = body.reason.trim();
    if (Array.isArray(body.kw)) rec.kw = body.kw.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
    if (body.prevUrl) {
      rec.prevUrl = String(body.prevUrl);
      rec.fullUrl = String(body.fullUrl || body.prevUrl);
      rec.w = Number(body.w) || rec.w;
      rec.h = Number(body.h) || rec.h;
      rec.src = 'upload';
      delete rec.pid;
    }
    saveLocalDb(db);
    return { asset: rec } as T;
  }

  if (assetMatch && method === 'DELETE') {
    const u = getAuth();
    if (!u) throw new Error('Sign in required.');
    const id = decodeURIComponent(assetMatch[1]);
    const rec = db.assets.find((x) => x.id === id);
    if (u.role !== 'admin' && (!rec || rec.owner !== u.email)) throw new Error('Not allowed.');
    if (SEED_ASSETS.some((x) => x.id === id) && !db.deletedSeed.includes(id)) db.deletedSeed.push(id);
    db.assets = db.assets.filter((x) => x.id !== id);
    saveLocalDb(db);
    return { ok: true } as T;
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const u = getAuth();
    if (!u) throw new Error('Sign in required.');
    const pricing = db.siteConfig.pricing;
    const bill = (body.bill || {}) as Record<string, unknown>;
    const order: Order = {
      id: 'SS-ORD-' + Date.now().toString(36).toUpperCase(),
      date: new Date().toISOString(),
      user: u.email,
      bill: {
        name: String(bill.name || u.name),
        email: String(bill.email || u.email),
        company: String(bill.company || u.company || ''),
        gstin: String(bill.gstin || u.gstin || ''),
        state: String(bill.state || u.state || 'Jharkhand'),
        pin: String(bill.pin || u.pin || ''),
      },
      pay: body.pay === 'credits' ? 'credits' : 'upi',
      status: body.pay === 'credits' ? 'paid' : 'pending',
      type: body.kind === 'cart' ? 'license' : 'credits',
      sub: 0,
      gst: 0,
      total: 0,
      items: [],
    };
    if (order.pay === 'upi') {
      const utr = String(body.utr || '').replace(/\s/g, '');
      if (!/^\d{12}$/.test(utr)) throw new Error('Enter the 12-digit UPI transaction ID (UTR).');
      if (db.orders.some((x) => x.utr === utr && x.status !== 'rejected')) throw new Error('This UTR is already used.');
      order.utr = utr;
    }
    const kind = String(body.kind || '');
    if (kind === 'cart') {
      const catalog = getCatalog(db, u);
      const valid = (Array.isArray(body.items) ? body.items : [])
        .map((c: { id: string; lic: 'std' | 'ext' | 'ed'; size: 'XS' | 'S' | 'M' | 'L' }) => {
          const a = catalog.find((x) => x.id === c.id);
          return a ? { ...c, price: pricing.matrix[c.lic]?.[c.size] ?? 19, asset: a } : null;
        })
        .filter(Boolean) as { id: string; lic: 'std' | 'ext' | 'ed'; size: 'XS' | 'S' | 'M' | 'L'; price: number; asset: Asset }[];
      if (!valid.length) throw new Error('Cart is empty.');
      const sub = valid.reduce((n, i) => n + i.price, 0);
      const gst = Math.round(sub * pricing.gst);
      const crNeed = valid.reduce((n, i) => n + (pricing.licMeta[i.lic]?.cr || 1), 0);
      if (order.pay === 'credits') {
        if ((u.credits || 0) < crNeed) throw new Error('Insufficient credits.');
        u.credits -= crNeed;
        order.credits = crNeed;
      } else {
        order.sub = sub;
        order.gst = gst;
        order.total = sub + gst;
      }
      order.items = valid.map((c) => ({
        id: c.id,
        lic: c.lic,
        size: c.size,
        price: c.price,
        key: licKey(),
        licensee: String(body.licensee || u.company || u.name),
        use: String(body.use || 'General media use'),
        title: c.asset.title,
        owner: c.asset.owner,
        lictype: c.asset.lic,
        royalty: Math.round(c.price * (c.asset.lic === 'editorial' ? pricing.royalty.editorial : pricing.royalty.rf)),
      }));
    } else if (kind.startsWith('plan:')) {
      const P = pricing.plans.find((x) => x.id === kind.slice(5));
      if (!P) throw new Error('Plan not found.');
      order.sub = P.p;
      order.gst = Math.round(P.p * pricing.gst);
      order.total = order.sub + order.gst;
      order.desc = `${P.n} plan`;
      order.addCr = P.cr;
      order.planId = P.id;
    } else if (kind.startsWith('pack:')) {
      const v = kind.slice(5);
      const P = pricing.packs.find((x) => x.id === v) || pricing.packs[Number(v)];
      if (!P) throw new Error('Pack not found.');
      order.sub = P.p;
      order.gst = Math.round(P.p * pricing.gst);
      order.total = order.sub + order.gst;
      order.desc = `${P.cr} credit pack`;
      order.addCr = P.cr;
    }
    db.orders.unshift(order);
    saveLocalDb(db);
    return { order, user: sanitizeUser(u) } as T;
  }

  const approveMatch = pathname.match(/^\/api\/orders\/([^/]+)\/(approve|reject)$/);
  if (method === 'POST' && approveMatch) {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    const o = db.orders.find((x) => x.id === decodeURIComponent(approveMatch[1]));
    if (!o || o.status !== 'pending') throw new Error('Order is not pending.');
    if (approveMatch[2] === 'approve') {
      o.status = 'paid';
      const buyer = db.users.find((x) => x.email === o.user);
      if (buyer && o.addCr) buyer.credits = (buyer.credits || 0) + o.addCr;
      if (buyer && o.planId) buyer.plan = { id: o.planId, since: new Date().toISOString() };
    } else o.status = 'rejected';
    saveLocalDb(db);
    return { order: o } as T;
  }

  if (method === 'GET' && pathname === '/api/verify-license') {
    const key = String(parsedUrl.searchParams.get('k') || '').trim().toUpperCase();
    for (const o of db.orders) {
      if (o.status && o.status !== 'paid') continue;
      for (const i of o.items) {
        if (i.key.toUpperCase() === key) {
          return {
            valid: true,
            license: { key: i.key, lic: i.lic, assetId: i.id, title: i.title, licensee: i.licensee, date: o.date },
          } as T;
        }
      }
    }
    return { valid: false } as T;
  }

  if (method === 'POST' && pathname === '/api/payouts') {
    const u = getAuth();
    if (!u || !['contributor', 'admin'].includes(u.role)) throw new Error('Contributor access required.');
    const upi = String(body.upi || '').trim();
    if (!upi) throw new Error('UPI ID required.');
    u.payout = { upi, pan: String(body.pan || '').trim().toUpperCase() };
    const earned = db.orders.flatMap((o) => o.items.filter((i) => i.owner === u.email)).reduce((n, s) => n + s.royalty, 0);
    const paid = db.payouts.filter((p) => p.user === u.email).reduce((n, p) => n + p.amt, 0);
    const bal = earned - paid;
    if (bal < db.siteConfig.pricing.payoutMin) {
      throw new Error(`Minimum payout balance is ${db.siteConfig.pricing.currency}${db.siteConfig.pricing.payoutMin}.`);
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
    saveLocalDb(db);
    return { payout } as T;
  }

  const payoutPayMatch = pathname.match(/^\/api\/payouts\/([^/]+)\/pay$/);
  if (payoutPayMatch && method === 'PUT') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    const p = db.payouts.find((x) => x.id === decodeURIComponent(payoutPayMatch[1]));
    if (!p) throw new Error('Payout not found.');
    p.status = 'paid';
    saveLocalDb(db);
    return { payout: p } as T;
  }

  const userRoleMatch = pathname.match(/^\/api\/users\/([^/]+)\/role$/);
  if (userRoleMatch && method === 'PUT') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    const target = db.users.find((x) => x.email === decodeURIComponent(userRoleMatch[1]).toLowerCase());
    if (!target) throw new Error('User not found.');
    if (body.role === 'buyer' || body.role === 'contributor' || body.role === 'admin') target.role = body.role;
    saveLocalDb(db);
    return { user: sanitizeUser(target) } as T;
  }

  if (method === 'PUT' && pathname === '/api/lightbox') {
    const u = getAuth();
    if (!u) throw new Error('Sign in required.');
    if (body.lightbox && typeof body.lightbox === 'object') {
      db.lightbox[u.email] = body.lightbox as Record<string, string[]>;
      saveLocalDb(db);
    }
    return { lightbox: db.lightbox[u.email] || { Favorites: [] } } as T;
  }

  if (method === 'POST' && pathname === '/api/newsletter') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email.includes('@')) throw new Error('Invalid email.');
    if (!db.newsletter.includes(email)) db.newsletter.push(email);
    saveLocalDb(db);
    return { ok: true } as T;
  }

  if (method === 'POST' && pathname === '/api/contact') {
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const message = String(body.message || '').trim().slice(0, 3000);
    const kind = body.kind ? String(body.kind).slice(0, 20) : '';
    const mobile = cleanMobile(body.mobile);
    const ratingN = Number(body.rating);
    const rating = ratingN >= 1 && ratingN <= 5 ? Math.round(ratingN) : undefined;
    const page = body.page ? String(body.page).slice(0, 120) : undefined;
    if (!name || !email || !message) throw new Error('All fields required.');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new Error('Please enter a valid email.');
    if (kind && !mobile) throw new Error('Please enter a valid 10-digit mobile number.');
    if (message.length < 10) throw new Error('Please write at least 10 characters.');
    const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').replace(/\n— page:.*$/, '').trim();
    if (db.messages.some((m) => m.email === email && norm(m.message) === norm(message))) throw new Error('You have already sent this same message. Please write something new.');
    const hourAgo = Date.now() - 3600_000;
    if (db.messages.filter((m) => m.email === email && Date.parse(m.date) > hourAgo).length >= 5) throw new Error('Too many messages. Please try again after an hour.');
    const id = (kind ? 'FB-' : 'MSG-') + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    db.messages.unshift({ id, name, email, message, date: new Date().toISOString(), mobile: mobile || undefined, kind: kind || undefined, rating, page });
    saveLocalDb(db);
    return { ok: true, id } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/export') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    return {
      siteConfig: db.siteConfig,
      assets: db.assets,
      deletedSeed: db.deletedSeed,
      orders: db.orders,
      payouts: db.payouts,
      newsletter: db.newsletter,
      messages: db.messages,
    } as T;
  }

  if (method === 'GET' && pathname === '/api/admin/github/status') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    return {
      tokenConfigured: false,
      fullSourceZipAvailable: false,
      config: db.githubSync || { owner: '', repo: '', branch: 'main', autoSync: false },
    } as T;
  }

  if (method === 'PUT' && pathname === '/api/admin/github/config') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    const owner = String(body.owner || '').trim();
    const repo = String(body.repo || '').trim();
    const branch = String(body.branch || 'main').trim() || 'main';
    const autoSync = Boolean(body.autoSync);
    if (owner || repo) {
      const check = validateGitHubRepoConfig(owner, repo, branch);
      if (!check.ok) throw new Error(check.error);
      db.githubSync = { ...(db.githubSync || { owner: '', repo: '', branch: 'main', autoSync: false }), owner: check.owner, repo: check.repo, branch: check.branch, autoSync };
    } else {
      db.githubSync = { owner: '', repo: '', branch: 'main', autoSync };
    }
    saveLocalDb(db);
    return { config: db.githubSync, tokenConfigured: false } as T;
  }

  if (method === 'POST' && pathname === '/api/admin/github/sync') {
    throw new Error('Server GITHUB_TOKEN is required for direct GitHub push. Connect your repo on Cloudflare Pages or download the Auto-Updated Source ZIP below.');
  }

  if (method === 'GET' && pathname === '/api/admin/github/latest') {
    const u = getAuth();
    if (!u || u.role !== 'admin') throw new Error('Admin access required.');
    const cfg = db.githubSync;
    if (!cfg?.owner || !cfg?.repo) throw new Error('Please configure GitHub owner & repository first.');
    const commit = await fetchLatestGitHubCommit(cfg);
    return { commit } as T;
  }

  throw new Error('Endpoint not found.');
}

export async function buildStaticFallbackZip(): Promise<{ blob: Blob; filename: string }> {
  const db = await loadLocalDb();
  const snapshot = buildLiveSnapshotPayload(db.siteConfig, db.assets, db.deletedSeed);
  const zipBytes = buildZip([
    { path: 'santalstock-update/src/data/liveSnapshot.json', data: JSON.stringify(snapshot, null, 2) + '\n' },
    { path: 'santalstock-update/.github/workflows/cloudflare-pages.yml', data: CLOUDFLARE_WORKFLOW_YML },
    { path: 'santalstock-update/.node-version', data: '22\n' },
    { path: 'santalstock-update/public/_headers', data: HEADERS_CONTENT },
  ]);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  return {
    blob: new Blob([zipBytes], { type: 'application/zip' }),
    filename: `santalstock-live-update-${stamp}.zip`,
  };
}
