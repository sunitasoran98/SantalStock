import { Camera, ShieldCheck, ShoppingBag } from 'lucide-react';

export type AuthPortal = 'buyer' | 'contributor' | 'admin';

export const PORTALS: { k: AuthPortal; label: string; sub: string; Icon: typeof Camera; c: string; soft: string }[] = [
  { k: 'buyer', label: 'Buyer', sub: 'Buy & download photos', Icon: ShoppingBag, c: '#1f6fd1', soft: '#e8f0ff' },
  { k: 'contributor', label: 'Contributor', sub: 'Sell your photos', Icon: Camera, c: '#e0730f', soft: '#fff0e3' },
  { k: 'admin', label: 'Admin', sub: 'Manage SantalStock', Icon: ShieldCheck, c: '#1b8a4b', soft: '#e6f6ef' },
];
