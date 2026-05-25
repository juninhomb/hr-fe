'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCw, X,
  Layers, Package, Boxes, Euro, Image as ImageIcon, Upload, Sparkles,
  Star, Eye, EyeOff, Filter, FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api, { resolveImageUrl } from '../../../lib/api';
import { parseInventoryImportWorkbook } from '../../../lib/inventoryExcel';
import { layoutFixedActionMenu } from '../../../lib/actionMenuPosition';
import { suggestCategoryId } from '../../../lib/categorySuggester';
import { compressImages } from '../../../lib/imageCompress';
import MultiImageGallery, {
  type GalleryImage,
  type PendingImage,
} from './MultiImageGallery';

type BaseProduct = {
  id: number;
  name: string;
  base_price: number;
  category_id: number | null;
  image_url: string | null;
  variant_count: number;
  characteristics?: string | null;
};
type Category = { id: number; name: string };
type CatalogColor = { id: number; name: string; sort_order: number };
type CreateMode = 'new_product' | 'new_variant';

export default function InventoryTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVisibility, setFilterVisibility] = useState<string>('all');
  const [filterStock, setFilterStock] = useState<string>('all');
  const [filterFeatured, setFilterFeatured] = useState<string>('all');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('new_product');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', base_price: '', sku: '', color_id: '' as string, size: '', stock_quantity: '0',
    product_id: '' as string,
    category_id: '' as string,
    characteristics: '',
  });
  const [categoryAuto, setCategoryAuto] = useState(true);  // sugestão automática ON por defeito

  const [productImages, setProductImages] = useState<GalleryImage[]>([]);
  const [productPending, setProductPending] = useState<PendingImage[]>([]);
  const [productDeleteIds, setProductDeleteIds] = useState<number[]>([]);

  const [variantImages, setVariantImages] = useState<GalleryImage[]>([]);
  const [variantPending, setVariantPending] = useState<PendingImage[]>([]);
  const [variantDeleteIds, setVariantDeleteIds] = useState<number[]>([]);
  const [variantApplyToColor, setVariantApplyToColor] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [compressingFiles, setCompressingFiles] = useState(0);
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>([]);
  const [catalogColors, setCatalogColors] = useState<CatalogColor[]>([]);

  const [openMenu, setOpenMenu] = useState<{ id: string; menuStyle: React.CSSProperties } | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [visibilityBusySku, setVisibilityBusySku] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    ok: boolean;
    text: string;
    details?: string[];
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const fetchProducts = async (q = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    }
  };

  const fetchCatalogColors = async () => {
    try {
      const res = await api.get<CatalogColor[]>('/colors');
      setCatalogColors(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCatalogColors([]);
    }
  };

  useEffect(() => { fetchProducts(); fetchCategories(); fetchCatalogColors(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Cleanup de blob URLs no unmount — evita leak quando o admin troca de
  // separador / faz logout / fecha browser com modal aberto.
  // Usamos refs para captar sempre o último valor sem retriggerar o effect.
  const pendingPreviewsRef = useRef<PendingImage[]>([]);
  useEffect(() => {
    pendingPreviewsRef.current = [...productPending, ...variantPending];
  }, [productPending, variantPending]);
  useEffect(() => {
    return () => {
      for (const p of pendingPreviewsRef.current) {
        if (p.preview.startsWith('blob:')) URL.revokeObjectURL(p.preview);
      }
    };
  }, []);

  const revokePending = (list: PendingImage[]) => {
    for (const p of list) {
      if (p.preview.startsWith('blob:')) URL.revokeObjectURL(p.preview);
    }
  };

  const clearGalleryState = () => {
    revokePending(productPending);
    revokePending(variantPending);
    setProductImages([]);
    setProductPending([]);
    setProductDeleteIds([]);
    setVariantImages([]);
    setVariantPending([]);
    setVariantDeleteIds([]);
    setVariantApplyToColor(false);
  };

  // Sugestão automática de categoria pelo prefixo do nome (só na criação
  // de novo produto e enquanto o admin não tenha tocado no select).
  useEffect(() => {
    if (modalMode !== 'create' || createMode !== 'new_product') return;
    if (!categoryAuto) return;
    const suggested = suggestCategoryId(form.name, categories);
    setForm(f => ({
      ...f,
      category_id: suggested != null ? String(suggested) : '',
    }));
  }, [form.name, categoryAuto, categories, modalMode, createMode]);

  const resetForm = () => {
    setForm({
      name: '', base_price: '', sku: '', color_id: '', size: '', stock_quantity: '0',
      product_id: '', category_id: '',
      characteristics: '',
    });
    setCategoryAuto(true);
    clearGalleryState();
    setFormError('');
  };

  const openModal = () => {
    resetForm();
    setEditingProduct(null);
    setCreateMode('new_product');
    setModalMode('create');
    api.get('/products/base').then(r => setBaseProducts(r.data || [])).catch(() => {});
    fetchCatalogColors();
  };

  const openEditModal = async (item: any) => {
    let colors = catalogColors;
    try {
      const res = await api.get<CatalogColor[]>('/colors');
      colors = Array.isArray(res.data) ? res.data : [];
      setCatalogColors(colors);
    } catch {
      /* mantém cache */
    }
    let cid = item.color_id != null && item.color_id !== '' ? String(item.color_id) : '';
    if (!cid && item.color && colors.length) {
      const nm = String(item.color).trim().toLowerCase();
      const m = colors.find((x) => x.name.trim().toLowerCase() === nm);
      if (m) cid = String(m.id);
    }
    setForm({
      name: item.name || '',
      base_price: String(item.price || ''),
      sku: item.sku || '',
      color_id: cid,
      size: item.size || '',
      stock_quantity: String(item.stock ?? 0),
      product_id: '',
      category_id: item.category_id != null ? String(item.category_id) : '',
      characteristics: item.product_characteristics ?? item.characteristics ?? '',
    });
    setCategoryAuto(false);
    clearGalleryState();
    setFormError('');
    setEditingProduct(item);
    setModalMode('edit');

    const pid = item.product_id;
    if (pid) {
      try {
        const pr = await api.get<GalleryImage[]>(`/products/${pid}/images`);
        setProductImages(Array.isArray(pr.data) ? pr.data : []);
      } catch {
        setProductImages([]);
      }
    }
    if (item.id) {
      try {
        const vr = await api.get<GalleryImage[]>(`/variants/${item.id}/images`);
        setVariantImages(Array.isArray(vr.data) ? vr.data : []);
      } catch {
        setVariantImages([]);
      }
    }
  };

  // Detecta SKU duplicado em tempo real (avisa antes do submit)
  const selectedColorName = useMemo(
    () => catalogColors.find((c) => String(c.id) === form.color_id)?.name ?? '',
    [catalogColors, form.color_id],
  );

  const skuConflict = useMemo(() => {
    if (modalMode !== 'create' || !form.sku.trim()) return false;
    const skuUp = form.sku.trim().toUpperCase();
    return products.some(p => p.sku === skuUp);
  }, [form.sku, products, modalMode]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterCategory === 'none') {
        if (p.category_id != null) return false;
      } else if (filterCategory !== 'all') {
        if (String(p.category_id) !== filterCategory) return false;
      }
      const visible = p.variant_is_active !== false;
      if (filterVisibility === 'visible' && !visible) return false;
      if (filterVisibility === 'hidden' && visible) return false;
      const stock = Number(p.stock) || 0;
      if (filterStock === 'out' && stock !== 0) return false;
      if (filterStock === 'low' && (stock < 1 || stock > 2)) return false;
      if (filterStock === 'ok' && stock <= 2) return false;
      if (filterFeatured === 'yes' && !p.is_featured) return false;
      if (filterFeatured === 'no' && p.is_featured) return false;
      return true;
    });
  }, [products, filterCategory, filterVisibility, filterStock, filterFeatured]);

  const inventoryFiltersActive =
    filterCategory !== 'all' ||
    filterVisibility !== 'all' ||
    filterStock !== 'all' ||
    filterFeatured !== 'all';

  const clearInventoryFilters = () => {
    setFilterCategory('all');
    setFilterVisibility('all');
    setFilterStock('all');
    setFilterFeatured('all');
  };

  const exportInventoryExcel = useCallback(() => {
    if (filteredProducts.length === 0) return;
    const rows = filteredProducts.map((item) => ({
      'ID variante': item.id,
      'ID produto': item.product_id ?? '',
      Produto: item.name ?? '',
      Cor: item.color ?? '',
      Tamanho: item.size ?? '',
      Categoria: item.category_name ?? '',
      SKU: item.sku ?? '',
      'Preço (€)': Number(item.price) || 0,
      Stock: Number(item.stock) || 0,
      'Visível na loja': item.variant_is_active !== false ? 'Sim' : 'Não',
      Destaque: item.is_featured ? 'Sim' : 'Não',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventário');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `inventario-hr-store-${dateStr}.xlsx`);
  }, [filteredProducts]);

  const runInventoryImport = async (file: File) => {
    setImportNotice(null);
    let ab: ArrayBuffer;
    try {
      ab = await file.arrayBuffer();
    } catch {
      setImportNotice({ ok: false, text: 'Não foi possível ler o ficheiro.' });
      return;
    }
    const { payloads, parseErrors, mapError } = parseInventoryImportWorkbook(ab);
    if (mapError) {
      setImportNotice({ ok: false, text: mapError });
      return;
    }
    if (parseErrors.length) {
      setImportNotice({
        ok: false,
        text: `${parseErrors.length} erro(s) no Excel — corrige antes de importar.`,
        details: parseErrors.slice(0, 20).map(
          (e) => `Linha ${e.sheetRow} da folha: ${e.reason}`
        ),
      });
      return;
    }
    if (!payloads.length) {
      setImportNotice({ ok: false, text: 'Nenhuma linha com SKU para importar.' });
      return;
    }
    setImporting(true);
    try {
      const res = await api.post('/products/import', { rows: payloads });
      const updated = Number(res.data?.updated) || 0;
      const failed = Array.isArray(res.data?.failed) ? res.data.failed : [];
      if (failed.length) {
        setImportNotice({
          ok: updated > 0,
          text:
            updated > 0
              ? `Actualizados: ${updated}. Linhas com erro: ${failed.length}.`
              : `Nenhuma linha actualizada. Erros: ${failed.length}.`,
          details: failed.slice(0, 25).map(
            (f: { row: number; sku: string; reason: string }) =>
              `Linha ${f.row}${f.sku ? ` · ${f.sku}` : ''}: ${f.reason}`
          ),
        });
      } else {
        setImportNotice({ ok: true, text: `${updated} linha(s) actualizadas com sucesso.` });
      }
      fetchProducts();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setImportNotice({ ok: false, text: msg || 'Falha ao importar.' });
    } finally {
      setImporting(false);
    }
  };

  // Totais de stock (unidades + valor a preço de venda) — respeitam filtros locais
  const stockTotals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => {
        const units = Number(p.stock) || 0;
        const price = Number(p.price) || 0;
        acc.units += units;
        acc.value += units * price;
        return acc;
      },
      { units: 0, value: 0 }
    );
  }, [filteredProducts]);

  // ID da sugestão de categoria — para exibir o badge "Auto" se bater certo
  const suggestedCategoryId = useMemo(() => {
    if (!form.name) return null;
    return suggestCategoryId(form.name, categories);
  }, [form.name, categories]);

  const addPendingFiles = async (
    files: File[],
    setPending: React.Dispatch<React.SetStateAction<PendingImage[]>>,
  ) => {
    if (!files.length) return;
    setCompressingFiles((n) => n + files.length);
    try {
      const results = await compressImages(files);
      const valid: PendingImage[] = [];
      let oversize = false;
      for (const r of results) {
        if (r.file.size > 5 * 1024 * 1024) {
          oversize = true;
          continue;
        }
        valid.push({
          key: `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: r.file,
          preview: URL.createObjectURL(r.file),
        });
      }
      if (oversize) {
        setFormError('Pelo menos 1 imagem ultrapassa 5 MB mesmo após compressão. Reduz a resolução antes de carregar.');
      } else if (valid.length) {
        setFormError('');
      }
      if (valid.length) {
        setPending((prev) => [...prev, ...valid]);
      }
    } finally {
      setCompressingFiles((n) => Math.max(0, n - files.length));
    }
  };

  const uploadPendingGallery = async (
    entity: 'products' | 'variants',
    entityId: number,
    pending: PendingImage[],
    opts?: { applyToColor?: boolean },
  ) => {
    if (!pending.length) return;
    const fd = new FormData();
    for (const p of pending) fd.append('images', p.file);
    if (opts?.applyToColor) fd.append('applyToColor', 'true');
    await api.post(`/${entity}/${entityId}/images`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const syncProductGallery = async (productId: number) => {
    for (const imageId of productDeleteIds) {
      await api.delete(`/products/${productId}/images/${imageId}`);
    }
    await uploadPendingGallery('products', productId, productPending);
  };

  const syncVariantGallery = async (variantId: number) => {
    for (const imageId of variantDeleteIds) {
      await api.delete(`/variants/${variantId}/images/${imageId}`);
    }
    await uploadPendingGallery('variants', variantId, variantPending, {
      applyToColor: variantApplyToColor,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (modalMode === 'create' && skuConflict) {
      setFormError('Este SKU já existe. Escolhe outro.');
      return;
    }

    let resolvedColorId: number | null = null;
    if (form.color_id && String(form.color_id).trim() !== '') {
      const n = parseInt(form.color_id, 10);
      if (!Number.isFinite(n)) {
        setFormError('Cor inválida.');
        return;
      }
      resolvedColorId = n;
    }

    setSaving(true);
    try {
      let productId: number | null = null;
      let newVariantId: number | null = null;

      if (modalMode === 'create') {
        if (createMode === 'new_product') {
          const res = await api.post('/products', {
            name: form.name.trim(),
            base_price: parseFloat(form.base_price) || 0,
            sku: form.sku.trim().toUpperCase(),
            color_id: resolvedColorId,
            size: form.size.trim() || null,
            stock_quantity: parseInt(form.stock_quantity) || 0,
            category_id: form.category_id ? parseInt(form.category_id, 10) : null,
            variant_is_active: true,
            characteristics: form.characteristics.trim() || null,
          });
          productId = res.data?.product_id ?? null;
        } else {
          if (!form.product_id) {
            setFormError('Seleciona um produto existente.');
            setSaving(false);
            return;
          }
          // Cria a variante
          const res = await api.post(`/products/${form.product_id}/variants`, {
            sku: form.sku.trim().toUpperCase(),
            color_id: resolvedColorId,
            size: form.size.trim() || null,
            stock_quantity: parseInt(form.stock_quantity) || 0,
            is_active: true,
          });
          newVariantId = res.data?.id ?? null;
          if (newVariantId && variantPending.length) {
            try {
              await uploadPendingGallery('variants', newVariantId, variantPending, {
                applyToColor: variantApplyToColor,
              });
            } catch (imgErr: any) {
              setFormError(
                imgErr?.response?.data?.error || 'Variante criada, mas falhou o upload das imagens.'
              );
              setSaving(false);
              fetchProducts();
              return;
            }
          }
        }
      } else {
        await api.put(`/products/${editingProduct.sku}`, {
          name: form.name.trim(),
          base_price: parseFloat(form.base_price) || 0,
          color_id: resolvedColorId,
          size: form.size.trim() || null,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          category_id: form.category_id ? parseInt(form.category_id, 10) : null,
          characteristics: form.characteristics.trim() || null,
        });
        productId = editingProduct.product_id ?? null;
      }

      if (productId != null && (productPending.length || productDeleteIds.length)) {
        try {
          await syncProductGallery(productId);
        } catch (imgErr: any) {
          setFormError(
            imgErr?.response?.data?.error || 'Produto guardado, mas falhou a galeria de imagens.'
          );
          setSaving(false);
          fetchProducts();
          return;
        }
      }

      if (modalMode === 'edit' && editingProduct?.id != null
        && (variantPending.length || variantDeleteIds.length)) {
        try {
          await syncVariantGallery(editingProduct.id);
        } catch (imgErr: any) {
          setFormError(
            imgErr?.response?.data?.error || 'Variante guardada, mas falhou a galeria de imagens.'
          );
          setSaving(false);
          fetchProducts();
          return;
        }
      }

      setModalMode(null);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Erro ao guardar produto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/products/${deletingProduct.sku}`);
      setDeletingProduct(null);
      fetchProducts();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || 'Erro ao eliminar produto');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle "destaque" no produto-base. Como `is_featured` vive ao nível do
  // produto (não da variante), todas as linhas da mesma family ficam em
  // sintonia depois do refetch.
  const toggleFeatured = async (item: any) => {
    if (!item?.product_id) return;
    try {
      await api.patch(`/products/${item.product_id}/featured`, {
        is_featured: !item.is_featured,
      });
      fetchProducts();
    } catch (err) {
      console.error('Erro a alternar destaque:', err);
    }
  };

  const toggleVariantStoreVisibility = async (item: any) => {
    if (!item?.sku || visibilityBusySku === item.sku) return;
    const currentlyVisible = item.variant_is_active !== false;
    setVisibilityBusySku(item.sku);
    try {
      await api.put(`/products/${item.sku}`, { variant_is_active: !currentlyVisible });
      await fetchProducts();
    } catch (err) {
      console.error('Erro a alterar visibilidade na loja:', err);
    } finally {
      setVisibilityBusySku(null);
    }
  };

  return (
    <>
      {/* Cards de totais (estilo Dashboard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 animate-in slide-in-from-bottom-4">
        <div className="bg-black text-white rounded-[32px] p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Boxes size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Itens em Stock</span>
          </div>
          <div className="text-4xl font-black font-mono">
            {stockTotals.units.toLocaleString('pt-PT')}
          </div>
        </div>
        <div className="bg-emerald-500 text-white rounded-[32px] p-7 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Euro size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Valor em Stock</span>
          </div>
          <div className="text-4xl font-black font-mono">
            € {stockTotals.value.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="p-8 border-b border-gray-50 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-xl">Inventário Completo</h3>
              {products.length > 0 && filteredProducts.length !== products.length && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  A mostrar {filteredProducts.length} de {products.length} linhas (filtros locais).
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fetchProducts()}
                className={`p-2.5 bg-zinc-50 rounded-xl border border-gray-100 ${loading ? 'animate-spin' : ''}`}
                title="Atualizar lista"
              >
                <RefreshCw size={17} />
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void runInventoryImport(f);
                }}
              />
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                disabled={loading || importing}
                className="border border-gray-200 bg-white text-black px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:bg-zinc-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="Importa Excel (mesmo formato exportado): só actualiza SKU existentes"
              >
                <Upload size={18} />
                <span className="hidden sm:inline">Importar</span>
              </button>
              <button
                type="button"
                onClick={exportInventoryExcel}
                disabled={loading || filteredProducts.length === 0}
                className="border border-gray-200 bg-white text-black px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:bg-zinc-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="Exporta as linhas visíveis (pesquisa e filtros) para ficheiro Excel"
              >
                <FileSpreadsheet size={18} />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                type="button"
                onClick={openModal}
                className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 hover:bg-zinc-800 transition"
              >
                <Plus size={18} />
                <span>Novo Item</span>
              </button>
            </div>
          </div>

          {importNotice && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                importNotice.ok
                  ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                  : 'border-amber-200 bg-amber-50/80 text-amber-950'
              }`}
            >
              <div className="flex justify-between gap-3 items-start">
                <p className="font-semibold leading-snug">{importNotice.text}</p>
                <button
                  type="button"
                  onClick={() => setImportNotice(null)}
                  className="shrink-0 text-[10px] uppercase font-bold opacity-70 hover:opacity-100"
                >
                  Fechar
                </button>
              </div>
              {importNotice.details && importNotice.details.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs font-mono opacity-90 max-h-40 overflow-y-auto">
                  {importNotice.details.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-zinc-50/80 rounded-[24px] border border-gray-100/80 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Filter size={14} />
                <span className="text-[10px] uppercase font-bold">Filtros</span>
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Nome ou SKU…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <InventoryFilterSelect
                label="Categoria"
                value={filterCategory}
                onChange={setFilterCategory}
                options={[
                  { v: 'all', l: 'Todas' },
                  { v: 'none', l: 'Sem categoria' },
                  ...categories.map(c => ({ v: String(c.id), l: c.name })),
                ]}
              />
              <InventoryFilterSelect
                label="Loja"
                value={filterVisibility}
                onChange={setFilterVisibility}
                options={[
                  { v: 'all', l: 'Todos' },
                  { v: 'visible', l: 'Visível' },
                  { v: 'hidden', l: 'Oculto' },
                ]}
              />
              <InventoryFilterSelect
                label="Stock"
                value={filterStock}
                onChange={setFilterStock}
                options={[
                  { v: 'all', l: 'Qualquer' },
                  { v: 'out', l: 'Sem stock (0)' },
                  { v: 'low', l: 'Baixo (1–2)' },
                  { v: 'ok', l: 'OK (mais de 2)' },
                ]}
              />
              <InventoryFilterSelect
                label="Destaque"
                value={filterFeatured}
                onChange={setFilterFeatured}
                options={[
                  { v: 'all', l: 'Todos' },
                  { v: 'yes', l: 'Só destaques' },
                  { v: 'no', l: 'Sem destaque' },
                ]}
              />
              {inventoryFiltersActive && (
                <button
                  type="button"
                  onClick={clearInventoryFilters}
                  className="text-[10px] uppercase font-bold text-zinc-500 hover:text-black px-3 py-2 rounded-xl border border-dashed border-zinc-300 hover:border-zinc-400 transition"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-zinc-400">
              <tr>
                <th className="px-6 py-5 text-black">Foto</th>
                <th className="px-6 py-5 text-black">Produto / Variação</th>
                <th className="px-6 py-5 text-black">Categoria</th>
                <th className="px-6 py-5 text-black">SKU</th>
                <th className="px-6 py-5 text-black text-right">Preço</th>
                <th className="px-6 py-5 text-black text-center">Stock</th>
                <th className="px-6 py-5 text-black text-center">Visível</th>
                <th className="px-6 py-5 text-black text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map((item) => {
                const imgFull = resolveImageUrl(item.image_url);
                const isVisibleOnStore = item.variant_is_active !== false;
                return (
                  <tr key={item.id} className="hover:bg-gray-50/30 transition group">
                    <td className="px-6 py-4">
                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
                        {imgFull ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imgFull} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-zinc-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-black inline-flex items-center gap-1.5 flex-wrap">
                          {item.name || 'Produto Base'}
                          {item.is_featured && (
                            <span
                              title="Marcado como destaque na home"
                              className="inline-flex items-center gap-1 text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200"
                            >
                              <Star size={9} className="fill-amber-500 text-amber-500" /> Destaque
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-400 uppercase font-medium">{item.color} | {item.size}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {item.category_name ? (
                        <span className="text-[10px] uppercase font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">
                          {item.category_name}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                          Sem categoria
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded font-bold text-zinc-600">{item.sku}</code>
                    </td>
                    <td className="px-6 py-5 text-sm font-mono text-right font-black text-black">
                      € {Number(item.price || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[11px] font-black ${
                        Number(item.stock) <= 2 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {item.stock} UN.
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span
                        title={isVisibleOnStore ? 'Visível na loja' : 'Oculto na loja'}
                        className={`inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 rounded-full text-[11px] font-black ${
                          isVisibleOnStore
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                        }`}
                      >
                        {visibilityBusySku === item.sku ? '…' : isVisibleOnStore ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center text-zinc-300">
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setOpenMenu(
                              openMenu?.id === item.sku
                                ? null
                                : { id: item.sku, menuStyle: layoutFixedActionMenu(rect) }
                            );
                          }}
                          className="hover:text-black transition p-1 rounded-lg hover:bg-zinc-100"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-8 py-16 text-center text-zinc-400 text-sm">
                    {products.length === 0
                      ? 'Nenhum produto encontrado.'
                      : 'Nenhum produto corresponde aos filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredProducts.length > 0 && (
              <tfoot className="bg-gray-50/70 border-t-2 border-gray-100">
                <tr>
                  <td className="px-6 py-5" colSpan={4}>
                    <span className="text-[10px] uppercase font-black tracking-wider text-black">
                      Total ({filteredProducts.length}{' '}
                      {filteredProducts.length === 1 ? 'item' : 'itens'}
                      {inventoryFiltersActive && products.length !== filteredProducts.length
                        ? ` · ${products.length} no total`
                        : ''})
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-mono font-black text-sm text-emerald-600">
                    € {stockTotals.value.toFixed(2)}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-4 py-1.5 rounded-full text-[11px] font-black bg-black text-white">
                      {stockTotals.units} UN.
                    </span>
                  </td>
                  <td className="px-6 py-5"></td>
                  <td className="px-6 py-5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Dropdown Menu (fixed — escapa do overflow-hidden) */}
      {openMenu && filteredProducts.some(p => p.sku === openMenu.id) && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
          <div
            className="fixed z-20 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 min-w-[11.5rem] overflow-x-hidden"
            style={openMenu.menuStyle}
          >
            {filteredProducts.filter(p => p.sku === openMenu.id).map(item => {
              const visibleInStore = item.variant_is_active !== false;
              const visibilityBusyForRow = visibilityBusySku === item.sku;
              return (
              <React.Fragment key={item.sku}>
                <button
                  onClick={() => { openEditModal(item); setOpenMenu(null); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition text-left"
                >
                  <Pencil size={14} />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => { toggleFeatured(item); setOpenMenu(null); }}
                  className={`w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition text-left ${
                    item.is_featured
                      ? 'text-amber-700 hover:bg-amber-50'
                      : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Star
                    size={14}
                    className={item.is_featured ? 'fill-amber-500 text-amber-500' : ''}
                  />
                  <span>{item.is_featured ? 'Remover destaque' : 'Marcar destaque'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { void toggleVariantStoreVisibility(item); setOpenMenu(null); }}
                  disabled={visibilityBusyForRow}
                  className={`w-full flex items-center space-x-2 px-4 py-2.5 text-sm transition text-left disabled:opacity-50 ${
                    visibleInStore ? 'text-zinc-700 hover:bg-zinc-50' : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {visibleInStore ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{visibleInStore ? 'Ocultar da loja' : 'Mostrar na loja'}</span>
                </button>
                <button
                  onClick={() => { setDeletingProduct(item); setOpenMenu(null); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                >
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              </React.Fragment>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Criar / Editar Produto */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-lg p-7 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-xl font-bold">
                  {modalMode === 'create'
                    ? (createMode === 'new_product' ? 'Novo Produto' : 'Adicionar Variante')
                    : 'Editar Variante'}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {modalMode === 'edit'
                    ? `SKU ${editingProduct?.sku} (não editável)`
                    : createMode === 'new_product'
                      ? 'Cria produto-base + primeira variante (cor/tamanho/SKU)'
                      : 'Adiciona uma nova combinação de cor/tamanho a um produto existente'}
                </p>
              </div>
              <button onClick={() => { setModalMode(null); resetForm(); }} className="p-2 hover:bg-zinc-100 rounded-xl transition">
                <X size={20} />
              </button>
            </div>

            {/* Toggle de modo (só na criação) */}
            {modalMode === 'create' && (
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => setCreateMode('new_product')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${
                    createMode === 'new_product' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'
                  }`}
                >
                  <Package size={13} /> Novo Produto
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('new_variant')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${
                    createMode === 'new_variant' ? 'bg-white shadow-sm text-black' : 'text-zinc-500'
                  }`}
                >
                  <Layers size={13} /> Adicionar Variante
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Modo: adicionar variante a produto existente */}
              {modalMode === 'create' && createMode === 'new_variant' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Produto existente *
                  </label>
                  <select
                    required
                    value={form.product_id}
                    onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  >
                    <option value="">— Selecionar produto —</option>
                    {baseProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (€ {Number(p.base_price).toFixed(2)} · {p.variant_count} variante{p.variant_count !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Preço base, nome e imagem herdados do produto. Define só cor/tamanho/SKU/stock abaixo.
                  </p>
                </div>
              )}

              {(modalMode === 'edit' || (modalMode === 'create' && createMode === 'new_product')) && (
                <MultiImageGallery
                  title="Fotos do produto"
                  hint="Partilhadas por variantes sem galeria própria. Até 12 imagens · JPG/PNG/WEBP · 5 MB cada."
                  existing={productImages}
                  pending={productPending}
                  deleteIds={productDeleteIds}
                  onAddFiles={(files) => addPendingFiles(files, setProductPending)}
                  onRemoveExisting={(id) => setProductDeleteIds((d) => [...d, id])}
                  onRestoreExisting={(id) => setProductDeleteIds((d) => d.filter((x) => x !== id))}
                  onRemovePending={(key) => {
                    setProductPending((prev) => {
                      const item = prev.find((p) => p.key === key);
                      if (item?.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
                      return prev.filter((p) => p.key !== key);
                    });
                  }}
                />
              )}

              {modalMode === 'edit' && (
                <div className="rounded-2xl bg-amber-50/40 border border-amber-200/60 p-4 space-y-3">
                  <MultiImageGallery
                    title={`Fotos desta variante (${selectedColorName || '—'} · ${form.size || '—'})`}
                    hint="Sobrepõem-se às fotos do produto. O cliente vê estas ao escolher cor/tamanho."
                    accent="amber"
                    existing={variantImages}
                    pending={variantPending}
                    deleteIds={variantDeleteIds}
                    onAddFiles={(files) => addPendingFiles(files, setVariantPending)}
                    onRemoveExisting={(id) => setVariantDeleteIds((d) => [...d, id])}
                    onRestoreExisting={(id) => setVariantDeleteIds((d) => d.filter((x) => x !== id))}
                    onRemovePending={(key) => {
                      setVariantPending((prev) => {
                        const item = prev.find((p) => p.key === key);
                        if (item?.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
                        return prev.filter((p) => p.key !== key);
                      });
                    }}
                  />
                  {variantPending.length > 0 && selectedColorName && (
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-amber-900">
                      <input
                        type="checkbox"
                        checked={variantApplyToColor}
                        onChange={e => setVariantApplyToColor(e.target.checked)}
                        className="accent-amber-600 mt-0.5"
                      />
                      <span>
                        <strong>Aplicar novas fotos a todas as variantes da cor &quot;{selectedColorName}&quot;</strong>
                      </span>
                    </label>
                  )}
                </div>
              )}

              {modalMode === 'create' && createMode === 'new_variant' && (
                <div className="rounded-2xl bg-amber-50/40 border border-amber-200/60 p-4 space-y-3">
                  <MultiImageGallery
                    title={`Fotos desta variante (${selectedColorName || '—'} · ${form.size || '—'})`}
                    hint="Opcional. Sem fotos aqui → usa as do produto-base."
                    accent="amber"
                    existing={[]}
                    pending={variantPending}
                    deleteIds={[]}
                    onAddFiles={(files) => addPendingFiles(files, setVariantPending)}
                    onRemoveExisting={() => {}}
                    onRestoreExisting={() => {}}
                    onRemovePending={(key) => {
                      setVariantPending((prev) => {
                        const item = prev.find((p) => p.key === key);
                        if (item?.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
                        return prev.filter((p) => p.key !== key);
                      });
                    }}
                  />
                  {variantPending.length > 0 && selectedColorName && (
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-amber-900">
                      <input
                        type="checkbox"
                        checked={variantApplyToColor}
                        onChange={e => setVariantApplyToColor(e.target.checked)}
                        className="accent-amber-600 mt-0.5"
                      />
                      <span>
                        <strong>Aplicar a todas as variantes da cor &quot;{selectedColorName}&quot;</strong>
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Nome + preço (só para novo produto ou edit) */}
              {(modalMode === 'edit' || (modalMode === 'create' && createMode === 'new_product')) && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Nome do Produto *
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="Ex: Vestido Atena"
                    />
                  </div>

                  {/* Categoria */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Categoria
                      </label>
                      {modalMode === 'create' && createMode === 'new_product' && (
                        <label className="text-[10px] text-zinc-500 inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={categoryAuto}
                            onChange={(e) => setCategoryAuto(e.target.checked)}
                            className="accent-black"
                          />
                          <span className="inline-flex items-center gap-1">
                            <Sparkles size={10} className="text-amber-500" />
                            Sugerir pelo nome
                          </span>
                        </label>
                      )}
                    </div>
                    <select
                      value={form.category_id}
                      onChange={e => {
                        setCategoryAuto(false);  // tocar = override manual
                        setForm(f => ({ ...f, category_id: e.target.value }));
                      }}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    >
                      <option value="">— Sem categoria —</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {suggestedCategoryId === c.id && categoryAuto ? '  (auto)' : ''}
                        </option>
                      ))}
                    </select>
                    {modalMode === 'create' && createMode === 'new_product' && categoryAuto && suggestedCategoryId && (
                      <p className="text-[10px] text-amber-600 mt-1 inline-flex items-center gap-1 font-bold">
                        <Sparkles size={10} />
                        Categoria sugerida automaticamente — desmarca acima para escolher à mão.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Preço Base (€) *
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.base_price}
                      onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black font-mono"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Características do produto
                    </label>
                    <textarea
                      value={form.characteristics}
                      onChange={e => setForm(f => ({ ...f, characteristics: e.target.value }))}
                      rows={4}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-y min-h-[88px] placeholder:text-zinc-400"
                      placeholder="Ex.: Tecido leve, forro interior, lavagem a frio. Visível na página do produto no site."
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Opcional. Texto curto mostrado na loja entre os botões de compra e a informação de envio.
                    </p>
                  </div>
                </>
              )}

              {/* SKU */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  SKU * <span className="text-zinc-400 normal-case font-normal">(único, ex: BIQ-AZUL-M)</span>
                </label>
                <input
                  required={modalMode === 'create'}
                  disabled={modalMode === 'edit'}
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 ${
                    skuConflict
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-200 focus:ring-black'
                  } ${modalMode === 'edit' ? 'bg-zinc-50 text-zinc-400 cursor-not-allowed' : ''}`}
                  placeholder="EX: CAM-BLK-M"
                />
                {skuConflict && (
                  <p className="text-[11px] text-red-600 font-bold mt-1">⚠ Este SKU já está em uso.</p>
                )}
              </div>

              {/* Cor + Tamanho */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Cor (opcional)
                  </label>
                  <select
                    value={form.color_id}
                    onChange={(e) => setForm((f) => ({ ...f, color_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  >
                    <option value="">— Sem cor (ex.: calça, só tamanho) —</option>
                    {catalogColors.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Opcional. Gerir lista em Configurações → Cores.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Tamanho</label>
                  <input
                    value={form.size}
                    onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black uppercase"
                    placeholder="Ex: M"
                  />
                </div>
              </div>

              {/* Stock */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Stock {modalMode === 'create' ? '(inicial)' : ''}
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.stock_quantity}
                  onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {compressingFiles > 0 && (
                <p className="text-zinc-700 text-xs font-semibold bg-zinc-50 border border-gray-100 px-4 py-2 rounded-xl flex items-center gap-2">
                  <RefreshCw size={12} className="animate-spin" />
                  A comprimir {compressingFiles} imagem{compressingFiles > 1 ? 'ns' : ''}…
                </p>
              )}
              {formError && (
                <p className="text-red-500 text-xs font-semibold bg-red-50 px-4 py-2 rounded-xl">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setModalMode(null); resetForm(); }}
                  className="flex-1 border border-gray-200 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || skuConflict || compressingFiles > 0}
                  className="flex-1 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? 'A guardar...'
                    : compressingFiles > 0
                      ? 'A comprimir imagens…'
                      : modalMode === 'create'
                        ? (createMode === 'new_product' ? 'Criar Produto' : 'Adicionar Variante')
                        : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo Confirmar Eliminação */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm mx-4 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-red-600">Eliminar Produto</h3>
              <button onClick={() => { setDeletingProduct(null); setDeleteError(''); }} className="p-2 hover:bg-zinc-100 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-zinc-600 mb-2">
              Tens a certeza que queres eliminar <span className="font-bold text-black">{deletingProduct.name}</span>?
            </p>
            <p className="text-xs text-zinc-400 mb-6">
              SKU: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono">{deletingProduct.sku}</code> — Esta ação não pode ser desfeita.
            </p>
            {deleteError && <p className="text-red-500 text-xs font-semibold bg-red-50 px-4 py-2 rounded-xl mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingProduct(null); setDeleteError(''); }}
                className="flex-1 border border-gray-200 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? 'A eliminar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InventoryFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase font-bold text-zinc-400 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-black max-w-[11rem] sm:max-w-none"
      >
        {options.map(o => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

