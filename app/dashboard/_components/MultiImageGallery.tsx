'use client';

import React, { useRef } from 'react';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { resolveImageUrl } from '../../../lib/api';

export type GalleryImage = {
  id: number;
  url: string;
};

export type PendingImage = {
  key: string;
  file: File;
  preview: string;
};

type Props = {
  title: string;
  hint: string;
  accent?: 'zinc' | 'amber';
  existing: GalleryImage[];
  pending: PendingImage[];
  deleteIds: number[];
  maxImages?: number;
  onAddFiles: (files: File[]) => void;
  onRemoveExisting: (id: number) => void;
  onRestoreExisting: (id: number) => void;
  onRemovePending: (key: string) => void;
};

export default function MultiImageGallery({
  title,
  hint,
  accent = 'zinc',
  existing,
  pending,
  deleteIds,
  maxImages = 12,
  onAddFiles,
  onRemoveExisting,
  onRestoreExisting,
  onRemovePending,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const labelClass = accent === 'amber' ? 'text-amber-900' : 'text-zinc-500';
  const visibleExisting = existing.filter((img) => !deleteIds.includes(img.id));
  const total = visibleExisting.length + pending.length;
  const atLimit = total >= maxImages;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    const room = maxImages - total;
    if (room <= 0) return;
    onAddFiles(list.slice(0, room));
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <label className={`text-[11px] font-bold uppercase tracking-wider ${labelClass}`}>
          {title}
        </label>
        <span className="text-[10px] font-bold text-zinc-400">
          {total}/{maxImages}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {existing.map((img) => {
          const marked = deleteIds.includes(img.id);
          const src = resolveImageUrl(img.url);
          return (
            <div
              key={`ex-${img.id}`}
              className={`relative h-20 w-16 rounded-xl overflow-hidden border ${
                marked ? 'border-red-300 opacity-40' : 'border-gray-200'
              }`}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-zinc-100 flex items-center justify-center">
                  <ImageIcon size={18} className="text-zinc-400" />
                </div>
              )}
              <button
                type="button"
                title={marked ? 'Restaurar' : 'Remover'}
                onClick={() =>
                  marked ? onRestoreExisting(img.id) : onRemoveExisting(img.id)
                }
                className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white hover:bg-black"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {pending.map((p) => (
          <div
            key={p.key}
            className="relative h-20 w-16 rounded-xl overflow-hidden border border-dashed border-amber-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 left-0 right-0 text-[8px] font-black uppercase bg-amber-500 text-white text-center py-0.5">
              Nova
            </span>
            <button
              type="button"
              onClick={() => onRemovePending(p.key)}
              className="absolute top-1 right-1 p-1 rounded-md bg-black/70 text-white hover:bg-black"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-20 w-16 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-black hover:text-black transition"
          >
            <Upload size={16} />
            <span className="text-[9px] font-bold">Adicionar</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      <p className="text-[10px] text-zinc-500">{hint}</p>
    </div>
  );
}
