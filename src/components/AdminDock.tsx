import React from 'react';
import { Palette, Plus, DollarSign, LayoutGrid, Shield, GitBranch, X } from 'lucide-react';
import type { AdminEditTarget } from '../types';

interface AdminDockProps {
  onEdit: (target: AdminEditTarget) => void;
  onNavigate: (hash: string) => void;
  onExit: () => void;
}

export function AdminDock({ onEdit, onNavigate, onExit }: AdminDockProps) {
  return (
    <div className="noprint fixed left-4 bottom-4 z-40 max-w-[calc(100vw-92px)] bg-[#011f43] text-white rounded-2xl shadow-2xl border border-white/15 px-3 py-2.5 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 pr-2 border-r border-white/20">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">Admin Mode</span>
        <span className="hidden md:inline text-[11px] text-white/75">Click any dashed part to edit</span>
      </div>

      <button
        type="button"
        onClick={() => onEdit({ section: 'heroTitle' })}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
      >
        <Palette className="w-3.5 h-3.5" /> Colors
      </button>

      <button
        type="button"
        onClick={() => onEdit({ section: 'addPhoto' })}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#d6262f] hover:bg-[#b81d25] text-xs font-semibold cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Photo
      </button>

      <button
        type="button"
        onClick={() => onEdit({ section: 'customSections' })}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
      >
        <LayoutGrid className="w-3.5 h-3.5" /> + Section
      </button>

      <button
        type="button"
        onClick={() => onEdit({ section: 'pricingMatrix' })}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
      >
        <DollarSign className="w-3.5 h-3.5" /> Prices
      </button>

      <button
        type="button"
        onClick={() => onNavigate('#/admin/github')}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0f766e] hover:bg-[#0d625b] text-xs font-semibold cursor-pointer"
      >
        <GitBranch className="w-3.5 h-3.5" /> GitHub / ZIP
      </button>

      <button
        type="button"
        onClick={() => onNavigate('#/admin')}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold cursor-pointer"
      >
        <Shield className="w-3.5 h-3.5" /> Panel
      </button>

      <button
        type="button"
        onClick={onExit}
        title="Exit Admin Mode"
        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/15 hover:bg-red-600 text-xs font-bold cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
