'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCw, X,
  Layers, Package, Boxes, Euro, Image as ImageIcon, Upload, Sparkles,
  Star,
} from 'lucide-react';
import api, { resolveImageUrl } from '../../../lib/api';
import { suggestCategoryId } from '../../../lib/categorySuggester';

type BaseProduct = {
  id: number;
  name: string;
  base_price: number;
  category_id: number | null;
  image_url: string | null;
  variant_count: number;
};
type Category = { id: number; name: string };
type CreateMode = 'new_product' | 'new_variant';

export default function InventoryTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('new_product');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', base_price: '', sku: '', color: '', size: '', stock_quantity: '0',
    product_id: '' as string,
    category_id: '' as string,
  });
  const [categoryAuto, setCategoryAuto] = useState(true);  // sugestão automática ON por defeito

  // Imagem do PRODUTO-base (fallback partilhado por todas as variantes)
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productImageRemoved, setProductImageRemoved] = useState(false);
  const productFileRef = useRef<HTMLInputElement | null>(null);

  // Imagem específica desta VARIANTE (override; só visível em edit)
  const [variantImageFile, setVariantImageFile] = useState<File | null>(null);
  const [variantImagePreview, setVariantImagePreview] = useState<string | null>(null);
  const [variantImageRemoved, setVariantImageRemoved] = useState(false);
  const [variantApplyToColor, setVariantApplyToColor] = useState(false);
  const variantFileRef = useRef<HTMLInputElement | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>([]);

  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

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
      name: '', base_price: '', sku: '', color: '', size: '', stock_quantity: '0',
      product_id: '', category_id: '',
    });
    setCategoryAuto(true);
    // Limpa ambas as zonas de imagem (produto e variante)
    if (productImagePreview && productImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(productImagePreview);
    }
    if (variantImagePreview && variantImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(variantImagePreview);
    }
    setProductImageFile(null);
    setProductImagePreview(null);
    setProductImageRemoved(false);
    setVariantImageFile(null);
    setVariantImagePreview(null);
    setVariantImageRemoved(false);
    setVariantApplyToColor(false);
    setFormError('');
    if (productFileRef.current) productFileRef.current.value = '';
    if (variantFileRef.current) variantFileRef.current.value = '';
  };

  const openModal = () => {
    resetForm();
    setEditingProduct(null);
    setCreateMode('new_product');
    setModalMode('create');
    api.get('/products/base').then(r => setBaseProducts(r.data || [])).catch(() => {});
  };

  const openEditModal = (item: any) => {
    setForm({
      name: item.name || '',
      base_price: String(item.price || ''),
      sku: item.sku || '',
      color: item.color || '',
      size: item.size || '',
      stock_quantity: String(item.stock ?? 0),
      product_id: '',
      category_id: item.category_id != null ? String(item.category_id) : '',
    });
    setCategoryAuto(false);  // em edit não queremos sobrescrever a categoria já escolhida
    // Pré-popular as 2 zonas de imagem com os valores actuais
    setProductImageFile(null);
    setProductImagePreview(resolveImageUrl(item.product_image));
    setProductImageRemoved(false);
    setVariantImageFile(null);
    setVariantImagePreview(resolveImageUrl(item.variant_image));
    setVariantImageRemoved(false);
    setVariantApplyToColor(false);
    setFormError('');
    setEditingProduct(item);
    setModalMode('edit');
  };

  // Detecta SKU duplicado em tempo real (avisa antes do submit)
  const skuConflict = useMemo(() => {
    if (modalMode !== 'create' || !form.sku.trim()) return false;
    const skuUp = form.sku.trim().toUpperCase();
    return products.some(p => p.sku === skuUp);
  }, [form.sku, products, modalMode]);

  // Totais de stock (unidades + valor a preço de venda)
  const stockTotals = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        const units = Number(p.stock) || 0;
        const price = Number(p.price) || 0;
        acc.units += units;
        acc.value += units * price;
        return acc;
      },
      { units: 0, value: 0 }
    );
  }, [products]);

  // ID da sugestão de categoria — para exibir o badge "Auto" se bater certo
  const suggestedCategoryId = useMemo(() => {
    if (!form.name) return null;
    return suggestCategoryId(form.name, categories);
  }, [form.name, categories]);

  // -------------------------------------------------------------
  // Imagem — handlers genéricos (factory para produto vs variante)
  // -------------------------------------------------------------
  const makeImageHandlers = (
    file: File | null,
    setFile: (f: File | null) => void,
    preview: string | null,
    setPreview: (p: string | null) => void,
    setRemoved: (b: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => ({
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) {
        setFormError('Imagem demasiado grande (máx. 5 MB).');
        e.target.value = '';
        return;
      }
      setFile(f);
      setRemoved(false);
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(f));
      setFormError('');
    },
    onRemove: () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview(null);
      setRemoved(true);
      if (inputRef.current) inputRef.current.value = '';
    },
  });

  // Sincroniza imagem do PRODUTO-base.
  const syncProductImage = async (productId: number) => {
    if (productImageFile) {
      const fd = new FormData();
      fd.append('image', productImageFile);
      await api.post(`/products/${productId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (productImageRemoved) {
      await api.delete(`/products/${productId}/image`);
    }
  };

  // Sincroniza imagem da VARIANTE específica.
  const syncVariantImage = async (variantId: number) => {
    if (variantImageFile) {
      const fd = new FormData();
      fd.append('image', variantImageFile);
      if (variantApplyToColor) fd.append('applyToColor', 'true');
      await api.post(`/variants/${variantId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (variantImageRemoved) {
      await api.delete(`/variants/${variantId}/image`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (modalMode === 'create' && skuConflict) {
      setFormError('Este SKU já existe. Escolhe outro.');
      return;
    }

    setSaving(true);
    try {
      let productId: number | null = null;

      if (modalMode === 'create') {
        if (createMode === 'new_product') {
          const res = await api.post('/products', {
            name: form.name.trim(),
            base_price: parseFloat(form.base_price) || 0,
            sku: form.sku.trim().toUpperCase(),
            color: form.color.trim() || null,
            size: form.size.trim() || null,
            stock_quantity: parseInt(form.stock_quantity) || 0,
            category_id: form.category_id ? parseInt(form.category_id, 10) : null,
          });
          productId = res.data?.product_id ?? null;
        } else {
          if (!form.product_id) {
            setFormError('Seleciona um produto existente.');
            setSaving(false);
            return;
          }
          await api.post(`/products/${form.product_id}/variants`, {
            sku: form.sku.trim().toUpperCase(),
            color: form.color.trim() || null,
            size: form.size.trim() || null,
            stock_quantity: parseInt(form.stock_quantity) || 0,
          });
          // Adicionar variante NÃO mexe na imagem nem na categoria — terminou aqui.
        }
      } else {
        await api.put(`/products/${editingProduct.sku}`, {
          name: form.name.trim(),
          base_price: parseFloat(form.base_price) || 0,
          color: form.color.trim() || null,
          size: form.size.trim() || null,
          stock_quantity: parseInt(form.stock_quantity) || 0,
          category_id: form.category_id ? parseInt(form.category_id, 10) : null,
        });
        productId = editingProduct.product_id ?? null;
      }

      // Upload/remoção de imagem do PRODUTO-base
      if (productId != null) {
        try { await syncProductImage(productId); }
        catch (imgErr: any) {
          console.error('Falha ao sincronizar imagem do produto:', imgErr);
          setFormError(
            imgErr?.response?.data?.error || 'Produto guardado, mas falhou o upload da imagem do produto.'
          );
          setSaving(false);
          fetchProducts();
          return;
        }
      }

      // Upload/remoção de imagem da VARIANTE (só em edit, com variant_id conhecido)
      if (modalMode === 'edit' && editingProduct?.id != null) {
        try { await syncVariantImage(editingProduct.id); }
        catch (imgErr: any) {
          console.error('Falha ao sincronizar imagem da variante:', imgErr);
          setFormError(
            imgErr?.response?.data?.error || 'Variante guardada, mas falhou o upload da imagem.'
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
        <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-xl">Inventário Completo</h3>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou SKU..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black w-64"
            />
          </div>
          <button
            onClick={() => fetchProducts()}
            className={`p-2 bg-zinc-50 rounded-xl border border-gray-100 ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={17} />
          </button>
          <button
            onClick={openModal}
            className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-zinc-800 transition shrink-0"
          >
            <Plus size={18} />
            <span>Novo Item</span>
          </button>
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
                <th className="px-6 py-5 text-black text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((item) => {
                const imgFull = resolveImageUrl(item.image_url);
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
                        <span className="font-bold text-sm text-black inline-flex items-center gap-1.5">
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
                        Number(item.stock) <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {item.stock} UN.
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
                                : { id: item.sku, top: rect.bottom + 4, right: window.innerWidth - rect.right }
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
              {products.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center text-zinc-400 text-sm">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
            {products.length > 0 && (
              <tfoot className="bg-gray-50/70 border-t-2 border-gray-100">
                <tr>
                  <td className="px-6 py-5" colSpan={4}>
                    <span className="text-[10px] uppercase font-black tracking-wider text-black">
                      Total ({products.length} {products.length === 1 ? 'item' : 'itens'})
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
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Dropdown Menu (fixed — escapa do overflow-hidden) */}
      {openMenu && products.some(p => p.sku === openMenu.id) && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
          <div
            className="fixed z-20 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 w-48 overflow-hidden"
            style={{ top: openMenu.top, right: openMenu.right }}
          >
            {products.filter(p => p.sku === openMenu.id).map(item => (
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
                  onClick={() => { setDeletingProduct(item); setOpenMenu(null); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
                >
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              </React.Fragment>
            ))}
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

              {/* IMAGEM DO PRODUTO-BASE (fallback partilhado por todas as variantes) */}
              {(modalMode === 'edit' || (modalMode === 'create' && createMode === 'new_product')) && (
                <ImageZone
                  title="Imagem do Produto"
                  hint="Fallback partilhado por todas as variantes que não tenham foto própria. JPG/PNG/WEBP até 5 MB."
                  preview={productImagePreview}
                  inputRef={productFileRef}
                  inputId="product-image-input"
                  handlers={makeImageHandlers(
                    productImageFile, setProductImageFile,
                    productImagePreview, setProductImagePreview,
                    setProductImageRemoved, productFileRef
                  )}
                />
              )}

              {/* IMAGEM DA VARIANTE (override específico — só em edit) */}
              {modalMode === 'edit' && (
                <div className="rounded-2xl bg-amber-50/40 border border-amber-200/60 p-4 space-y-3">
                  <ImageZone
                    title={`Imagem desta variante (${form.color || '—'} · ${form.size || '—'})`}
                    hint={
                      variantImagePreview
                        ? 'Esta foto sobrepõe-se à do produto-base só para esta variante.'
                        : 'Sem foto própria → usa a foto do produto acima.'
                    }
                    preview={variantImagePreview}
                    inputRef={variantFileRef}
                    inputId="variant-image-input"
                    accent="amber"
                    handlers={makeImageHandlers(
                      variantImageFile, setVariantImageFile,
                      variantImagePreview, setVariantImagePreview,
                      setVariantImageRemoved, variantFileRef
                    )}
                  />
                  {/* Aplicar a todas as variantes da mesma cor (atalho útil) */}
                  {variantImageFile && form.color && (
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-amber-900">
                      <input
                        type="checkbox"
                        checked={variantApplyToColor}
                        onChange={e => setVariantApplyToColor(e.target.checked)}
                        className="accent-amber-600 mt-0.5"
                      />
                      <span>
                        <strong>Aplicar a todas as variantes da cor &quot;{form.color}&quot;</strong> deste
                        produto (útil porque tipicamente foto varia por cor, não por tamanho).
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Atalho criar+upload imagem para o PRODUTO-base no modo "novo produto" */}
              {modalMode === 'create' && createMode === 'new_variant' && (
                <p className="text-[10px] text-zinc-500 bg-zinc-50 rounded-xl px-3 py-2">
                  💡 Para definir foto específica desta variante, primeiro cria-a e depois usa
                  <strong> Editar</strong> na tabela.
                </p>
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Cor</label>
                  <input
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black uppercase"
                    placeholder="Ex: PRETO"
                  />
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
                  disabled={saving || skuConflict}
                  className="flex-1 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? 'A guardar...'
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

// =====================================================
// Componente interno reutilizado para as 2 zonas de imagem
// (produto-base + variante específica) no modal.
// =====================================================
function ImageZone({
  title,
  hint,
  preview,
  inputRef,
  inputId,
  handlers,
  accent = 'zinc',
}: {
  title: string;
  hint: string;
  preview: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputId: string;
  handlers: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
  };
  accent?: 'zinc' | 'amber';
}) {
  const labelClass =
    accent === 'amber'
      ? 'text-amber-900'
      : 'text-zinc-500';

  return (
    <div>
      <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${labelClass}`}>
        {title}
      </label>
      <div className="flex items-center gap-4">
        <div className="h-24 w-20 rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={22} className="text-zinc-400" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            onChange={handlers.onChange}
            className="hidden"
            id={inputId}
          />
          <label
            htmlFor={inputId}
            className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 hover:border-black hover:bg-zinc-50 transition"
          >
            <Upload size={13} /> {preview ? 'Trocar imagem' : 'Carregar imagem'}
          </label>
          {preview && (
            <button
              type="button"
              onClick={handlers.onRemove}
              className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 size={13} /> Remover
            </button>
          )}
          <p className="text-[10px] text-zinc-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}
