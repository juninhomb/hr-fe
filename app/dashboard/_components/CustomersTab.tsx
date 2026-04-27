'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCw, X, Phone, Mail, ShoppingBag } from 'lucide-react';
import api from '../../../lib/api';

export default function CustomersTab() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [form, setForm] = useState({ full_name: '', whatsapp_number: '', email: '', address: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<any>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = async (q = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const openModal = () => {
    setForm({ full_name: '', whatsapp_number: '', email: '', address: '' });
    setFormError('');
    setEditingCustomer(null);
    setModalMode('create');
  };

  const openEditModal = (c: any) => {
    setForm({
      full_name: c.full_name || '',
      whatsapp_number: c.whatsapp_number || '',
      email: c.email || '',
      address: c.address || '',
    });
    setFormError('');
    setEditingCustomer(c);
    setModalMode('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/customers', {
        name: form.full_name,
        whatsapp_number: form.whatsapp_number,
        email: form.email || null,
        address: form.address || null,
      });
      setModalMode(null);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err?.response?.data?.error || 'Erro ao guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/customers/${encodeURIComponent(deletingCustomer.whatsapp_number)}`);
      setDeletingCustomer(null);
      fetchCustomers();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || 'Erro ao eliminar cliente');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-xl">Base de Clientes</h3>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou whatsapp..."
              className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black w-64"
            />
          </div>
          <button
            onClick={() => fetchCustomers()}
            className={`p-2 bg-zinc-50 rounded-xl border border-gray-100 ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={17} />
          </button>
          <button
            onClick={openModal}
            className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-zinc-800 transition shrink-0"
          >
            <Plus size={18} />
            <span>Novo Cliente</span>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-zinc-400">
              <tr>
                <th className="px-8 py-5 text-black">Cliente</th>
                <th className="px-8 py-5 text-black">WhatsApp</th>
                <th className="px-8 py-5 text-black">Email</th>
                <th className="px-8 py-5 text-black">Morada</th>
                <th className="px-8 py-5 text-black text-center">Pedidos</th>
                <th className="px-8 py-5 text-black text-center">Desde</th>
                <th className="px-8 py-5 text-black text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/30 transition group">
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-sm text-zinc-600 shrink-0">
                        {(c.full_name || '?')[0].toUpperCase()}
                      </div>
                      <span className="font-bold text-sm text-black">{c.full_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-1.5 text-zinc-600">
                      <Phone size={13} className="text-zinc-400" />
                      <span className="text-sm font-mono">{c.whatsapp_number}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-1.5 text-zinc-500">
                      <Mail size={13} className="text-zinc-400" />
                      <span className="text-sm">{c.email || <span className="text-zinc-300 italic">sem email</span>}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-zinc-500 max-w-[160px] block truncate" title={c.address || ''}>
                      {c.address || <span className="text-zinc-300 italic text-xs">sem morada</span>}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <ShoppingBag size={13} className="text-zinc-400" />
                      <span className={`text-sm font-black ${Number(c.total_orders) > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                        {c.total_orders ?? 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-xs text-zinc-400">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('pt-PT') : '—'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center text-zinc-300">
                    <div className="flex justify-center">
                      <button
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setOpenMenu(
                            openMenu?.id === String(c.id)
                              ? null
                              : { id: String(c.id), top: rect.bottom + 4, right: window.innerWidth - rect.right }
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
              {customers.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center text-zinc-400 text-sm">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dropdown Menu (fixed) */}
      {openMenu && customers.some(c => String(c.id) === openMenu.id) && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
          <div
            className="fixed z-20 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 w-40 overflow-hidden"
            style={{ top: openMenu.top, right: openMenu.right }}
          >
            {customers.filter(c => String(c.id) === openMenu.id).map(c => (
              <React.Fragment key={c.id}>
                <button
                  onClick={() => { openEditModal(c); setOpenMenu(null); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition text-left"
                >
                  <Pencil size={14} />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => { setDeletingCustomer(c); setOpenMenu(null); }}
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

      {/* Modal Criar / Editar Cliente */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md mx-4 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{modalMode === 'create' ? 'Novo Cliente' : 'Editar Cliente'}</h3>
              <button onClick={() => setModalMode(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Nome Completo *</label>
                <input
                  required
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">WhatsApp *</label>
                <input
                  required
                  disabled={modalMode === 'edit'}
                  value={form.whatsapp_number}
                  onChange={e => setForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                  className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black ${modalMode === 'edit' ? 'bg-zinc-50 text-zinc-400 cursor-not-allowed' : ''}`}
                  placeholder="+351912345678"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Formato: +351912345678 (10-15 dígitos)</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="exemplo@email.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Morada</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Ex: Rua das Flores, 12, 1º Esq., Lisboa"
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
                  disabled={saving}
                  className="flex-1 bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  {saving ? 'A guardar...' : modalMode === 'create' ? 'Criar Cliente' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo Confirmar Eliminar Cliente */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm mx-4 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-red-600">Eliminar Cliente</h3>
              <button onClick={() => { setDeletingCustomer(null); setDeleteError(''); }} className="p-2 hover:bg-zinc-100 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-zinc-600 mb-2">
              Tens a certeza que queres eliminar <span className="font-bold text-black">{deletingCustomer.full_name}</span>?
            </p>
            <p className="text-xs text-zinc-400 mb-6">
              WhatsApp: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono">{deletingCustomer.whatsapp_number}</code> — O histórico de pedidos é preservado.
            </p>
            {deleteError && <p className="text-red-500 text-xs font-semibold bg-red-50 px-4 py-2 rounded-xl mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeletingCustomer(null); setDeleteError(''); }}
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
