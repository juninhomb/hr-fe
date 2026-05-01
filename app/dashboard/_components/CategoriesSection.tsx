'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, RefreshCw, Save, Trash2, X, Pencil, Tags, Image as ImageIcon, Upload,
} from 'lucide-react';
import api, { resolveImageUrl, resolveCategoryImageUrl } from '../../../lib/api';

/**
 * CRUD de Categorias para o painel de Configurações.
 *
 * Usado pela home do site público para popular a grelha "Encontra o teu
 * estilo" e como filtro lateral em /produtos. Cada categoria pode ter:
 *   - nome (único)
 *   - descrição opcional
 *   - imagem (opcional — fallback é o gradient bege existente)
 *   - sort_order (menor = aparece primeiro)
 *
 * Endpoints usados (backend):
 *   GET    /categories
 *   POST   /categories
 *   PUT    /categories/:id
 *   DELETE /categories/:id
 *   POST   /categories/:categoryId/image  (multipart, field "image")
 *   DELETE /categories/:categoryId/image
 */
type Category = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  product_count: number;
};

type FormState = {
  id?: number;
  name: string;
  description: string;
  sort_order: string;
  imageFile: File | null;
  // Preview real (blob:… ou URL absoluta para imagem já em servidor).
  // Quando NULL → usamos o placeholder na UI, mas o flag `hasRealImage`
  // continua a indicar se há ficheiro guardado em DB para distinguir
  // "sem foto" (mostra Carregar) de "tem foto" (mostra Trocar / Remover).
  imagePreview: string | null;
  hasRealImage: boolean;
  imageRemoved: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  sort_order: '100',
  imageFile: null,
  imagePreview: null,
  hasRealImage: false,
  imageRemoved: false,
};

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Category[]>('/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Não foi possível carregar as categorias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  // Cleanup blob URL no unmount (modal aberto + tab change/logout).
  const editingRef = useRef<FormState | null>(null);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => {
    return () => {
      const p = editingRef.current?.imagePreview;
      if (p && p.startsWith('blob:')) URL.revokeObjectURL(p);
    };
  }, []);

  const startCreate = () => setEditing({ ...EMPTY_FORM });
  const startEdit = (c: Category) =>
    setEditing({
      id: c.id,
      name: c.name,
      description: c.description ?? '',
      sort_order: String(c.sort_order),
      imageFile: null,
      imagePreview: resolveImageUrl(c.image_url),
      hasRealImage: !!c.image_url,
      imageRemoved: false,
    });

  const closeModal = () => {
    if (editing?.imagePreview && editing.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editing.imagePreview);
    }
    setEditing(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem demasiado grande (máx. 5 MB).');
      e.target.value = '';
      return;
    }
    if (editing.imagePreview && editing.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editing.imagePreview);
    }
    setEditing({
      ...editing,
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
      hasRealImage: true,
      imageRemoved: false,
    });
    setError('');
  };

  const onRemoveImage = () => {
    if (!editing) return;
    if (editing.imagePreview && editing.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editing.imagePreview);
    }
    setEditing({
      ...editing,
      imageFile: null,
      imagePreview: null,
      hasRealImage: false,
      imageRemoved: true,
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      let categoryId = editing.id;

      const body = {
        name: editing.name.trim(),
        description: editing.description.trim() || null,
        sort_order: editing.sort_order ? parseInt(editing.sort_order, 10) : 100,
      };

      if (categoryId) {
        await api.put(`/categories/${categoryId}`, body);
      } else {
        const res = await api.post('/categories', body);
        categoryId = res.data?.id;
      }

      if (categoryId) {
        if (editing.imageFile) {
          const fd = new FormData();
          fd.append('image', editing.imageFile);
          await api.post(`/categories/${categoryId}/image`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else if (editing.imageRemoved) {
          await api.delete(`/categories/${categoryId}/image`);
        }
      }

      closeModal();
      await fetchCategories();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao gravar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/categories/${confirmDelete.id}`);
      setConfirmDelete(null);
      await fetchCategories();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao apagar categoria.');
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-black/5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-black/5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#F5EFE6] text-clay-600">
              <Tags size={16} />
            </span>
            <h3 className="text-lg font-bold tracking-tight">Categorias</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-2xl">
            Categorias usadas pelo site público (grelha &ldquo;Encontra o teu estilo&rdquo;).
            Atribui uma imagem para personalizar cada cartão. Apagar uma categoria
            desliga-a dos produtos (ficam sem categoria, mas continuam visíveis).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCategories}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 px-3 py-2 rounded-full border border-black/10 hover:border-black disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-black text-white px-3 py-2 rounded-full hover:bg-zinc-800"
          >
            <Plus size={14} /> Nova categoria
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Grelha visual */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => {
          // Sempre devolve uma URL: imagem real ou o placeholder partilhado
          // (`/uploads/categories/placeholder.svg`) que o site público também
          // consome. Atualizar a foto aqui reflete imediatamente no site.
          const img = resolveCategoryImageUrl(c.image_url);
          return (
            <div
              key={c.id}
              className="group relative rounded-2xl border border-black/5 bg-white overflow-hidden shadow-sm hover:shadow-md transition"
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-[#F5EFE6] to-[#E9DFCD] relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={c.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {!c.image_url && (
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/85 text-zinc-700 backdrop-blur border border-black/5">
                    <ImageIcon size={10} /> sem foto
                  </span>
                )}
                <span className="absolute top-2 left-2 inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/70 text-white backdrop-blur">
                  #{c.sort_order}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{c.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {c.product_count} {c.product_count === 1 ? 'produto' : 'produtos'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(c)}
                      title="Editar"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-black/10 hover:border-black text-zinc-600"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(c)}
                      title="Apagar"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-black/10 hover:border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {c.description && (
                  <p className="mt-2 text-[11px] text-zinc-500 line-clamp-2">{c.description}</p>
                )}
              </div>
            </div>
          );
        })}
        {!categories.length && !loading && (
          <p className="col-span-full text-center text-zinc-500 text-sm py-12">
            Sem categorias. Carrega em <strong>Nova categoria</strong> para criar.
          </p>
        )}
      </div>

      {/* Modal Criar/Editar */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <h4 className="text-lg font-bold tracking-tight">
                {editing.id ? 'Editar categoria' : 'Nova categoria'}
              </h4>
              <button
                onClick={closeModal}
                className="p-2 -m-2 hover:bg-zinc-100 rounded-xl"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Imagem */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Imagem
                </label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-24 w-32 rounded-2xl bg-gradient-to-br from-[#F5EFE6] to-[#E9DFCD] overflow-hidden flex items-center justify-center text-clay-600 shrink-0 border border-black/5 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editing.imagePreview || resolveCategoryImageUrl(null)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {!editing.hasRealImage && (
                      <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/85 text-zinc-700 border border-black/5">
                        <ImageIcon size={9} /> placeholder
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={onPickImage}
                      className="hidden"
                      id="category-image-input"
                    />
                    <label
                      htmlFor="category-image-input"
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border border-black/10 hover:border-black bg-white cursor-pointer"
                    >
                      <Upload size={12} /> {editing.hasRealImage ? 'Trocar imagem' : 'Carregar imagem'}
                    </label>
                    {editing.hasRealImage && (
                      <button
                        type="button"
                        onClick={onRemoveImage}
                        className="ml-2 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} /> Remover
                      </button>
                    )}
                    <p className="text-[11px] text-zinc-500">
                      JPG/PNG/WEBP até 5 MB. Recomenda-se proporção 4:3. Sem
                      foto, o site mostra o mesmo placeholder bege.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Nome *
                </label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex: Vestidos"
                  className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Descrição (opcional)
                </label>
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  placeholder="Curta descrição visível na sidebar dos produtos."
                  className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Ordem
                  </label>
                  <input
                    inputMode="numeric"
                    value={editing.sort_order}
                    onChange={(e) =>
                      setEditing({ ...editing, sort_order: e.target.value.replace(/\D/g, '') || '0' })
                    }
                    placeholder="100"
                    className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    Menor número = aparece primeiro.
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-black/5 bg-[#FBF8F4]/60 rounded-b-[28px]">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-zinc-700 bg-white border border-black/10 hover:border-black"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.name.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-black text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? 'A gravar…' : (<><Save size={14} /> Gravar</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar apagar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-base font-bold">Apagar categoria?</h4>
            <p className="mt-2 text-sm text-zinc-600">
              Vais remover <strong>{confirmDelete.name}</strong>.
              {confirmDelete.product_count > 0 && (
                <>
                  {' '}Os <strong>{confirmDelete.product_count}</strong> produto
                  {confirmDelete.product_count !== 1 ? 's' : ''} associado
                  {confirmDelete.product_count !== 1 ? 's' : ''} ficam sem categoria
                  (continuam visíveis).
                </>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-zinc-700 border border-black/10 hover:border-black"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-red-600 text-white hover:bg-red-700"
              >
                <Trash2 size={12} /> Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
