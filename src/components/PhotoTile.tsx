import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { thumbUrl, tr } from '../data/defaults';
import type { Asset, LangCode } from '../types';

interface PhotoTileProps {
  asset: Asset;
  lang: LangCode;
  isFav: boolean;
  adminMode: boolean;
  onToggleFav: (id: string) => void;
  onOpenAsset: (id: string) => void;
  onAdminEdit: (id: string) => void;
  onAdminDelete: (id: string) => void;
}

export function PhotoTile({
  asset,
  lang,
  isFav,
  adminMode,
  onToggleFav,
  onOpenAsset,
  onAdminEdit,
  onAdminDelete,
}: PhotoTileProps) {
  const [imgErr, setImgErr] = useState(false);
  const src = thumbUrl(asset, 600);

  return (
    <a
      href={`#/asset/${asset.id}`}
      onClick={(e) => {
        e.preventDefault();
        onOpenAsset(asset.id);
      }}
      className={`tile wm group ${adminMode ? 'ring-2 ring-dashed ring-[#d6262f]/70' : ''}`}
    >
      {!imgErr && src ? (
        <img
          loading="lazy"
          src={src}
          alt={asset.title}
          width={asset.w}
          height={asset.h}
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          style={{ aspectRatio: `${asset.w}/${asset.h}` }}
        />
      ) : (
        <div
          className="w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#dce4f2] to-[#c7d3e8] text-[#011f43] p-4 text-center"
          style={{ aspectRatio: `${asset.w}/${asset.h}`, minHeight: 160 }}
        >
          <span className="font-bold text-sm">{asset.title}</span>
          <span className="text-xs opacity-70">{asset.cat} · {asset.id}</span>
        </div>
      )}

      <span className="absolute top-2 left-2 z-10">
        {asset.lic === 'editorial' ? (
          <span className="inline-block text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full uppercase bg-[#f2e8fd] text-[#8a2be2]">
            {tr(lang, 'ed')}
          </span>
        ) : (
          <span className="inline-block text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full uppercase bg-[#e6f4ea] text-[#11602d]">
            {tr(lang, 'rf')}
          </span>
        )}
      </span>

      <button
        type="button"
        title="Lightbox"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFav(asset.id);
        }}
        className={`absolute top-1.5 right-1.5 z-10 w-8 h-8 rounded-full bg-white text-[#d6262f] flex items-center justify-center text-base shadow cursor-pointer transition-opacity ${
          isFav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {isFav ? '♥' : '♡'}
      </button>

      {adminMode && (
        <div className="absolute top-11 right-1.5 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAdminEdit(asset.id);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#011f43] text-white text-[11px] font-bold shadow cursor-pointer hover:bg-[#0d2f5c]"
            title="Edit photo"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAdminDelete(asset.id);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#d6262f] text-white text-[11px] font-bold shadow cursor-pointer hover:bg-[#b81d25]"
            title="Delete photo"
          >
            <Trash2 className="w-3 h-3" /> Del
          </button>
        </div>
      )}

      <span className="ov">
        <b>{asset.title}</b>
        <br />
        {asset.contributor} · {asset.id}
      </span>
    </a>
  );
}
