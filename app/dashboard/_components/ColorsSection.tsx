'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, RefreshCw, Save, Trash2, X, Pencil, Palette,
} from 'lucide-react';
import api from '../../../lib/api';

/**
 * CRUD de cores canónicas (Configurações).
 * O inventário escolhe cor por ID — evita duplicados "BEGE" / "Bege".
 */
type CatalogColor = {
  id: number;
  name: string;
  sort_order: number;
  variant_count?: number;
};

type FormState = {
  id?: number;
  name: string;
  sort_order: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  sort_order: '100',
};

export default function ColorsSection() {
  const [colors, setColors] = useState<CatalogColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogColor | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const fetchColors = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<CatalogColor[]>('/colors');
      setColors(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Não foi possível carregar as cores.');
      setColors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors();
  }, []);

  const startCreate = () => {
    setEditing({ ...EMPTY_FORM });
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const startEdit = (c: CatalogColor) => {
    setEditing({
      id: c.id,
      name: c.name,
      sort_order: String(c.sort_order),
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    const body = {
      name: editing.name.trim(),
      sort_order: editing.sort_order,
    };
    if (!body.name) {
      setError('Indica o nome da cor.');
      setSaving(false);
      return;
    }
    try {
      if (editing.id) {
        await api.put(`/colors/${editing.id}`, body);
      } else {
        await api.post('/colors', body);
      }
      setEditing(null);
      await fetchColors();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao gravar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/colors/${confirmDelete.id}`);
      setConfirmDelete(null);
      await fetchColors();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao apagar.');
      setConfirmDelete(null);
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-black/5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-black/5">
        <div className="flex items-center gap-2">
          <Palette size={20} className="text-clay-600" />
          <div>
            <h3 className="text-lg font-black tracking-tight">Cores do catálogo</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Lista única usada no inventário e no site. As cores actuais das variantes foram importadas na migração.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchColors()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-sm font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-sm font-bold hover:bg-zinc-800"
          >
            <Plus size={16} />
            Nova cor
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <p className="text-sm text-red-600 font-semibold bg-red-50 px-4 py-2 rounded-xl mb-4">
            {error}
          </p>
        )}

        {editing && (
          <div className="mb-6 p-4 rounded-2xl border border-black/10 bg-[#F8F9FA] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black">
                {editing.id ? `Editar cor #${editing.id}` : 'Nova cor'}
              </p>
              <button
                type="button"
                onClick={() => { setEditing(null); setError(''); }}
                className="p-1.5 rounded-lg hover:bg-white"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Nome (ex.: Bege)
                </label>
                <input
                  ref={nameRef}
                  value={editing.name}
                  onChange={(e) => setEditing((s) => (s ? { ...s, name: e.target.value } : s))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Ordem (menor = primeiro)
                </label>
                <input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) => setEditing((s) => (s ? { ...s, sort_order: e.target.value } : s))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black text-white text-sm font-bold disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'A gravar…' : 'Guardar'}
            </button>
          </div>
        )}

        {loading && colors.length === 0 ? (
          <p className="text-sm text-zinc-500">A carregar…</p>
        ) : colors.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Sem cores. Corre a migração SQL no servidor (catalog_colors) ou adiciona uma cor.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 rounded-2xl border border-black/5 overflow-hidden">
            {colors.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-zinc-50/80"
              >
                <div>
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ordem {c.sort_order}
                    {typeof c.variant_count === 'number' ? ` · ${c.variant_count} variante(s)` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-black/10"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c)}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-600"
                    title="Apagar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h4 className="font-black text-lg mb-2">Apagar cor?</h4>
            <p className="text-sm text-zinc-600 mb-4">
              <strong>{confirmDelete.name}</strong>
              {confirmDelete.variant_count ? (
                <> — em uso ({confirmDelete.variant_count} variante(s)). A operação pode falhar.</>
              ) : null}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-black/10 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
