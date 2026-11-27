export type LangCode = 'satr' | 'satd' | 'hi' | 'en';
export type UserRole = 'buyer' | 'contributor' | 'admin';
export type AssetLicense = 'rf' | 'editorial';
export type AssetStatus = 'approved' | 'pending' | 'rejected';
export type LicenseOptionKey = 'std' | 'ext' | 'ed';
export type SizeKey = 'XS' | 'S' | 'M' | 'L';

export interface User {
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  credits: number;
  plan: { id: string; since: string } | null;
  joined: string;
  mobile?: string;
  company?: string;
  gstin?: string;
  state?: string;
  pin?: string;
  payout?: { upi?: string; pan?: string };
}

export interface Asset {
  id: string;
  /** Running photo number (#01, #02 …) given on upload. */
  serial?: number;
  pid?: string;
  w: number;
  h: number;
  by?: string;
  contributor: string;
  owner: string;
  cat: string;
  lic: AssetLicense;
  title: string;
  desc?: string;
  kw: string[];
  dl: number;
  date: string;
  status: AssetStatus;
  src: 'seed' | 'upload';
  release?: string;
  relfile?: string;
  caption?: string;
  evdate?: string;
  place?: string;
  reason?: string;
  prevUrl?: string;
  fullUrl?: string;
  /* duplicate detection */
  sha256?: string;
  phash?: string;
  dhash?: string;
  dup?: { id: string; kind: 'exact' | 'similar'; score: number }[];
  web?: { checked: string; count: number; links: { title: string; url: string; source?: string }[]; error?: string };
}

export interface CartItem {
  id: string;
  lic: LicenseOptionKey;
  size: SizeKey;
  price: number;
}

export interface OrderItem extends CartItem {
  key: string;
  licensee: string;
  use: string;
  title: string;
  owner: string;
  lictype: AssetLicense;
  royalty: number;
}

export interface Order {
  id: string;
  date: string;
  user: string;
  bill: {
    name: string;
    email: string;
    company?: string;
    gstin?: string;
    state?: string;
    pin?: string;
  };
  pay: 'credits' | 'upi' | 'card';
  type: 'license' | 'credits';
  sub: number;
  gst: number;
  total: number;
  credits?: number;
  items: OrderItem[];
  desc?: string;
  addCr?: number;
  /** paid = license/credits active; pending = UPI paid, admin verifying UTR; rejected = UTR not found */
  status?: 'paid' | 'pending' | 'rejected';
  utr?: string;
  planId?: string;
}

export interface Payout {
  id: string;
  user: string;
  amt: number;
  upi: string;
  date: string;
  status: 'requested' | 'paid';
}

export interface ColorSegment {
  text: string;
  color: string;
}

export interface FeatureCardConfig {
  id: string;
  badge: string;
  badgeType: 'rf' | 'ed' | 'custom';
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  buttonStyle: 'primary' | 'alt' | 'red';
}

export interface CustomSectionConfig {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  bgColor: string;
  textColor: string;
  btnColor: string;
}

export interface NavLinkConfig {
  id: string;
  label: string;
  href: string;
  i18nKey?: string;
}

export interface QuickChipConfig {
  id: string;
  label: string;
  href: string;
}

export interface PlanConfig {
  id: string;
  n: string;
  cr: number;
  p: number;
  d: string;
  hot?: boolean;
}

export interface PackConfig {
  id: string;
  cr: number;
  p: number;
}

export interface SizeConfig {
  k: SizeKey;
  n: string;
  px: number;
}

export interface PricingConfig {
  currency: string;
  gst: number;
  payoutMin: number;
  royalty: { rf: number; editorial: number };
  sizes: SizeConfig[];
  matrix: Record<LicenseOptionKey, Record<SizeKey, number>>;
  licMeta: Record<LicenseOptionKey, { n: string; cr: number; type: AssetLicense; desc: string }>;
  plans: PlanConfig[];
  packs: PackConfig[];
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface LicenseRow {
  id: string;
  use: string;
  std: string;
  ext: string;
  ed: string;
}

export interface FooterColumn {
  id: string;
  heading: string;
  links: { id: string; label: string; href: string }[];
}

export interface SiteConfig {
  brand: {
    logoPart1: ColorSegment;
    logoPart2: ColorSegment;
    heroAbbr: ColorSegment[];
    heroDividerColor: string;
    heroFull: ColorSegment[];
    searchBtnBg: string;
    searchBtnIcon: string;
    searchPlaceholderCustom?: string;
  };
  hero: {
    headingCustom?: string;
    subtitleCustom?: string;
    chips: QuickChipConfig[];
  };
  subnav: NavLinkConfig[];
  featureCards: FeatureCardConfig[];
  customSections: CustomSectionConfig[];
  ctaBanner: {
    visible: boolean;
    titleCustom?: string;
    subtitleCustom?: string;
    buttonTextCustom?: string;
    buttonLink: string;
    bgColor: string;
    textColor: string;
  };
  pricing: PricingConfig;
  payment?: {
    upiId: string;
    payeeName: string;
    whatsapp: string;
  };
  licenseRows: LicenseRow[];
  faqs: FaqItem[];
  pages: {
    about: { title: string; body: string };
    privacy: { title: string; body: string };
    refund: { title: string; body: string };
    terms: { title: string; sections: { id: string; heading: string; content: string }[] };
  };
  contact: {
    email: string;
    location: string;
    venture: string;
  };
  footer: {
    newsletterTitle: string;
    newsletterSubtitle: string;
    taglineCustom?: string;
    paymentMethods: string[];
    columns: FooterColumn[];
    madeWith: string;
    rights: string;
  };
  settings: {
    gstin: string;
    customCategories: string[];
  };
}

export type AdminEditSection =
  | 'brandLogo'
  | 'heroTitle'
  | 'searchBar'
  | 'subnav'
  | 'heroText'
  | 'heroChips'
  | 'featureCards'
  | 'customSections'
  | 'ctaBanner'
  | 'pricingMatrix'
  | 'plans'
  | 'packs'
  | 'licenseRows'
  | 'faqs'
  | 'pageAbout'
  | 'pagePrivacy'
  | 'pageRefund'
  | 'pageTerms'
  | 'contact'
  | 'footer'
  | 'categories'
  | 'addPhoto'
  | 'editPhoto';

export interface AdminEditTarget {
  section: AdminEditSection;
  itemId?: string;
}

export interface GitHubSyncConfig {
  owner: string;
  repo: string;
  branch: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  lastCommitSha?: string;
  lastCommitUrl?: string;
  lastError?: string;
}

export interface GitHubCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  htmlUrl: string;
  archiveZipUrl: string;
}


export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  date: string;
  mobile?: string;
  kind?: string;
  rating?: number;
  page?: string;
}
