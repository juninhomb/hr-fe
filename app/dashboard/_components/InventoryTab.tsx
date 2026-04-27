'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCw, X, Layers, Package, Boxes, Euro } from 'lucide-react';
import api from '../../../lib/api';

type BaseProduct = { id: number; name: string; base_price: number; variant_count: number };
type CreateMode = 'new_product' | 'new_variant';

export default function InventoryTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('new_product');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', base_price: '', sku: '', color: '', size: '', stock_quantity: '0',
    product_id: '' as string,
  });
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

  useEffect(() => { fetchProducts(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const openModal = () => {
    setForm({ name: '', base_price: '', sku: '', color: '', size: '', stock_quantity: '0', product_id: '' });
    setFormError('');
    setEditingProduct(null);
    setCreateMode('new_product');
    setModalMode('create');
    // Carregar produtos-base para o modo "adicionar variante"
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
    });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validações client-side
    if (modalMode === 'create' && skuConflict) {
      setFormError('Este SKU já existe. Escolhe outro.');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        if (createMode === 'new_product') {
          await api.post('/products', {
            name: form.name.trim(),
            base_price: parseFloat(form.base_price) || 0,
            sku: form.sku.trim().toUpperCase(),
            color: form.color.trim() || null,
            size: form.size.trim() || null,
            stock_quantity: parseInt(form.stock_quantity) || 0,
          });
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
        }
      } else {
        await api.put(`/products/${editingProduct.sku}`, {
          name: form.name.trim(),
          base_price: parseFloat(form.base_price) || 0,
          color: form.color.trim() || null,
          size: form.size.trim() || null,
          stock_quantity: parseInt(form.stock_quantity) || 0,
        });
      }
      setModalMode(null);
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
        {/* Header */}
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-zinc-400">
              <tr>
                <th className="px-8 py-5 text-black">Produto / Variação</th>
                <th className="px-8 py-5 text-black">SKU</th>
                <th className="px-8 py-5 text-black text-right">Preço</th>
                <th className="px-8 py-5 text-black text-center">Stock</th>
                <th className="px-8 py-5 text-black text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/30 transition group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-black">{item.name || 'Produto Base'}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-medium">{item.color} | {item.size}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded font-bold text-zinc-600">{item.sku}</code>
                  </td>
                  <td className="px-8 py-5 text-sm font-mono text-right font-black text-black">
                    € {Number(item.price || 0).toFixed(2)}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[11px] font-black ${
                      Number(item.stock) <= 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {item.stock} UN.
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center text-zinc-300">
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
              ))}
              {products.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-zinc-400 text-sm">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
            {products.length > 0 && (
              <tfoot className="bg-gray-50/70 border-t-2 border-gray-100">
                <tr>
                  <td className="px-8 py-5" colSpan={2}>
                    <span className="text-[10px] uppercase font-black tracking-wider text-black">
                      Total ({products.length} {products.length === 1 ? 'item' : 'itens'})
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-mono font-black text-sm text-emerald-600">
                    € {stockTotals.value.toFixed(2)}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="px-4 py-1.5 rounded-full text-[11px] font-black bg-black text-white">
                      {stockTotals.units} UN.
                    </span>
                  </td>
                  <td className="px-8 py-5"></td>
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
            className="fixed z-20 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 w-40 overflow-hidden"
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
              <button onClick={() => setModalMode(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition">
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
                    Preço base e nome herdados do produto. Define só cor/tamanho/SKU/stock abaixo.
                  </p>
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
                      placeholder="Ex: Camisola Oversize"
                    />
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
                  onClick={() => setModalMode(null)}
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
