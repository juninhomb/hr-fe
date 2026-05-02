'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, RefreshCw, X, Phone, Mail, ShoppingBag, MapPin,
} from 'lucide-react';
import api from '../../../lib/api';
import { layoutFixedActionMenu } from '../../../lib/actionMenuPosition';
import { sanitizeWhatsappDigits } from '../../../lib/whatsappDigits';

type CustomerForm = {
  full_name: string;
  whatsapp_number: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
  district: string;
  country: string;
};

type NewAddressDraft = {
  label: string;
  street_name: string;
  street_number: string;
  apartment: string;
  address_obs: string;
  postal_code: string;
  city: string;
  district: string;
  country: string;
};

const emptyForm = (): CustomerForm => ({
  full_name: '',
  whatsapp_number: '',
  email: '',
  phone: '',
  address: '',
  postal_code: '',
  city: '',
  district: '',
  country: 'PT',
});

const emptyNewAddress = (): NewAddressDraft => ({
  label: '',
  street_name: '',
  street_number: '',
  apartment: '',
  address_obs: '',
  postal_code: '',
  city: '',
  district: '',
  country: 'PT',
});

function formFromCustomer(c: Record<string, unknown>): CustomerForm {
  return {
    full_name: String(c.full_name ?? ''),
    whatsapp_number: sanitizeWhatsappDigits(String(c.whatsapp_number ?? ''), 15),
    email: String(c.email ?? ''),
    phone: String(c.phone ?? ''),
    address: String(c.address ?? ''),
    postal_code: String(c.postal_code ?? ''),
    city: String(c.city ?? ''),
    district: String(c.district ?? ''),
    country: String(c.country ?? 'PT') || 'PT',
  };
}

export default function CustomersTab() {
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [newAddr, setNewAddr] = useState<NewAddressDraft>(emptyNewAddress);
  const [addrSaving, setAddrSaving] = useState(false);

  const [openMenu, setOpenMenu] = useState<{ id: string; menuStyle: React.CSSProperties } | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Record<string, unknown> | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const res = await api.get(`/customers${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const delay = search ? 350 : 0;
    const timer = setTimeout(() => fetchCustomers(search), delay);
    return () => clearTimeout(timer);
  }, [search, fetchCustomers]);

  const reloadEditingDetail = async (wa: string) => {
    const res = await api.get(`/customers/${encodeURIComponent(wa)}`);
    setEditingCustomer(res.data);
    setForm(formFromCustomer(res.data));
  };

  const openModal = () => {
    setForm(emptyForm());
    setNewAddr(emptyNewAddress());
    setFormError('');
    setEditingCustomer(null);
    setModalMode('create');
  };

  const openEditModal = async (c: Record<string, unknown>) => {
    setFormError('');
    setNewAddr(emptyNewAddress());
    setModalMode('edit');
    setForm(formFromCustomer(c));
    setEditingCustomer({ ...c, addresses: undefined });
    try {
      await reloadEditingDetail(String(c.whatsapp_number));
    } catch {
      setEditingCustomer(c);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/customers', {
        full_name: form.full_name.trim() || null,
        whatsapp_number: form.whatsapp_number.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        country: (form.country.trim() || 'PT').toUpperCase().slice(0, 2),
      });
      setModalMode(null);
      fetchCustomers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax?.response?.data?.error || 'Erro ao guardar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSavedAddress = async () => {
    if (modalMode !== 'edit') return;
    setFormError('');
    setAddrSaving(true);
    try {
      await api.post(
        `/customers/${encodeURIComponent(form.whatsapp_number)}/addresses`,
        {
          label: newAddr.label.trim() || null,
          street_name: newAddr.street_name.trim(),
          street_number: newAddr.street_number.trim(),
          apartment: newAddr.apartment.trim() || null,
          address_obs: newAddr.address_obs.trim() || null,
          postal_code: newAddr.postal_code.trim(),
          city: newAddr.city.trim() || null,
          district: newAddr.district.trim() || null,
          country: (newAddr.country.trim() || 'PT').toUpperCase().slice(0, 2),
        },
      );
      setNewAddr(emptyNewAddress());
      await reloadEditingDetail(form.whatsapp_number);
      fetchCustomers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax?.response?.data?.error || 'Erro ao adicionar morada');
    } finally {
      setAddrSaving(false);
    }
  };

  const removeSavedAddress = async (id: number) => {
    if (!confirm('Remover esta morada da lista de sugestões na loja?')) return;
    setFormError('');
    try {
      await api.delete(
        `/customers/${encodeURIComponent(form.whatsapp_number)}/addresses/${id}`,
      );
      await reloadEditingDetail(form.whatsapp_number);
      fetchCustomers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      alert(ax?.response?.data?.error || 'Erro ao eliminar morada');
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer?.whatsapp_number) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/customers/${encodeURIComponent(String(deletingCustomer.whatsapp_number))}`);
      setDeletingCustomer(null);
      fetchCustomers();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setDeleteError(ax?.response?.data?.error || 'Erro ao eliminar cliente');
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black';

  return (
    <>
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
        <div className="p-8 border-b border-gray-50 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 space-y-1">
              <h3 className="font-bold text-xl">Clientes</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xl">
                O <strong>número de contacto</strong> é a chave única do registo (o mesmo das encomendas). Podes guardar várias{' '}
                <strong>moradas sugeridas</strong> por cliente para a loja online.
              </p>
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, número, email, cidade ou CP..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black w-full sm:w-72"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchCustomers()}
              className={`p-2 bg-zinc-50 rounded-xl border border-gray-100 shrink-0 ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={17} />
            </button>
            <button
              type="button"
              onClick={openModal}
              className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center space-x-2 hover:bg-zinc-800 transition shrink-0"
            >
              <Plus size={18} />
              <span>Novo cliente</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-zinc-400">
              <tr>
                <th className="px-6 py-4 text-black">Cliente</th>
                <th className="px-6 py-4 text-black">Nº (chave)</th>
                <th className="px-6 py-4 text-black">Email</th>
                <th className="px-6 py-4 text-black">Morada registo</th>
                <th className="px-6 py-4 text-black text-center" title="Linhas guardadas como sugestão na loja">
                  Agenda
                </th>
                <th className="px-6 py-4 text-black text-center">Pedidos</th>
                <th className="px-6 py-4 text-black text-center">Desde</th>
                <th className="px-6 py-4 text-black text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map((c) => (
                <tr key={String(c.id)} className="hover:bg-gray-50/30 transition group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-sm text-zinc-600 shrink-0">
                        {String((c.full_name as string) || '?')[0].toUpperCase()}
                      </div>
                      <span className="font-bold text-sm text-black">{(c.full_name as string) || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1.5 text-zinc-600">
                      <Phone size={13} className="text-zinc-400 shrink-0" />
                      <span className="text-sm font-mono break-all">{String(c.whatsapp_number)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1.5 text-zinc-500 max-w-[140px]">
                      <Mail size={13} className="text-zinc-400 shrink-0" />
                      <span className="text-sm truncate">{c.email ? String(c.email) : <span className="text-zinc-300 italic">—</span>}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-[220px]">
                    <div className="flex items-start gap-1.5 text-zinc-600">
                      <MapPin size={13} className="text-zinc-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span
                          className="text-sm block truncate"
                          title={String(c.address || '')}
                        >
                          {c.address ? String(c.address) : <span className="text-zinc-300 italic text-xs">sem texto livre</span>}
                        </span>
                        {(c.postal_code || c.city || c.district) ? (
                          <span className="text-[10px] text-zinc-400 block truncate mt-0.5" title={[c.postal_code, c.city, c.district].filter(Boolean).join(' · ')}>
                            {[c.postal_code, c.city].filter(Boolean).join(' · ')}
                            {c.district ? ` · ${String(c.district)}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-black ${Number(c.address_count || 0) > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>
                      {Number(c.address_count ?? 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <ShoppingBag size={13} className="text-zinc-400" />
                      <span className={`text-sm font-black ${Number(c.total_orders) > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                        {Number(c.total_orders ?? 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs text-zinc-400">
                      {c.created_at ? new Date(String(c.created_at)).toLocaleDateString('pt-PT') : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-zinc-300">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setOpenMenu(
                            openMenu?.id === String(c.id)
                              ? null
                              : { id: String(c.id), menuStyle: layoutFixedActionMenu(rect) },
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
                  <td colSpan={8} className="px-8 py-16 text-center text-zinc-400 text-sm">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openMenu && customers.some((c) => String(c.id) === openMenu.id) && (
        <>
          <div className="fixed inset-0 z-10" role="presentation" onClick={() => setOpenMenu(null)} />
          <div
            className="fixed z-20 bg-white border border-gray-100 rounded-2xl shadow-xl py-1 w-40 overflow-x-hidden"
            style={openMenu.menuStyle}
          >
            {customers.filter((c) => String(c.id) === openMenu.id).map((c) => (
              <React.Fragment key={String(c.id)}>
                <button
                  type="button"
                  onClick={() => { openEditModal(c); setOpenMenu(null); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition text-left"
                >
                  <Pencil size={14} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
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

      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{modalMode === 'create' ? 'Novo cliente' : 'Editar cliente'}</h3>
              <button type="button" onClick={() => setModalMode(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Nome *</label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    className={inputCls}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Número (chave única) *
                  </label>
                  <input
                    required
                    disabled={modalMode === 'edit'}
                    value={form.whatsapp_number}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, whatsapp_number: sanitizeWhatsappDigits(e.target.value, 15) }))}
                    className={`${inputCls} font-mono ${modalMode === 'edit' ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed' : ''}`}
                    placeholder="351912345678"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Apenas dígitos com código do país (10–15), sem + — chave única. Não editável depois de criado.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Telemóvel / alt.
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: sanitizeWhatsappDigits(e.target.value, 20) }))}
                    className={`${inputCls} font-mono`}
                    placeholder="351912345678 (opcional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Morada (texto livre)
                </label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className={inputCls}
                  placeholder="Linha única para notas rápidas / leituras antigas"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Campos estruturados (último registo na ficha)</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Código postal</label>
                    <input
                      value={form.postal_code}
                      onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                      className={inputCls}
                      placeholder="2700-001"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">País</label>
                    <input
                      value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase().slice(0, 2) }))}
                      className={inputCls}
                      placeholder="PT"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Localidade</label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Distrito</label>
                    <input
                      value={form.district}
                      onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {modalMode === 'edit' && Array.isArray(editingCustomer?.addresses) && (
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Agenda de moradas ({editingCustomer.addresses.length})
                  </p>
                  <ul className="space-y-2">
                    {(editingCustomer.addresses as Record<string, unknown>[]).map((ad) => (
                      <li
                        key={String(ad.id)}
                        className="flex items-start gap-2 justify-between border border-gray-100 rounded-xl px-3 py-2.5 bg-zinc-50/90 text-xs text-zinc-700"
                      >
                        <span className="min-w-0">
                          <span className="font-semibold text-zinc-900">
                            {[ad.street_name, ad.street_number].filter(Boolean).join(', ')}
                          </span>
                          {' '}
                          <span className="text-zinc-500">
                            · {[ad.postal_code, ad.city].filter(Boolean).join(' ')}
                            {ad.district ? ` · ${String(ad.district)}` : ''}
                          </span>
                        </span>
                        <button
                          type="button"
                          title="Remover da agenda"
                          onClick={() => removeSavedAddress(Number(ad.id))}
                          className="shrink-0 p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 bg-white space-y-3">
                    <p className="text-[11px] font-bold text-zinc-700">Adicionar morada à agenda</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        value={newAddr.label}
                        onChange={(e) => setNewAddr((a) => ({ ...a, label: e.target.value }))}
                        className={inputCls}
                        placeholder="Etiqueta (opcional, ex.: Casa)"
                      />
                      <input
                        value={newAddr.street_name}
                        onChange={(e) => setNewAddr((a) => ({ ...a, street_name: e.target.value }))}
                        className={`${inputCls} sm:col-span-2`}
                        placeholder="Via / arruamento *"
                      />
                      <input
                        value={newAddr.street_number}
                        onChange={(e) => setNewAddr((a) => ({ ...a, street_number: e.target.value }))}
                        className={inputCls}
                        placeholder="Número"
                      />
                      <input
                        value={newAddr.postal_code}
                        onChange={(e) => setNewAddr((a) => ({ ...a, postal_code: e.target.value }))}
                        className={inputCls}
                        placeholder="Código postal *"
                      />
                      <input
                        value={newAddr.city}
                        onChange={(e) => setNewAddr((a) => ({ ...a, city: e.target.value }))}
                        className={inputCls}
                        placeholder="Localidade"
                      />
                      <input
                        value={newAddr.district}
                        onChange={(e) => setNewAddr((a) => ({ ...a, district: e.target.value }))}
                        className={inputCls}
                        placeholder="Distrito"
                      />
                      <input
                        value={newAddr.country}
                        onChange={(e) => setNewAddr((a) => ({ ...a, country: e.target.value.toUpperCase().slice(0, 2) }))}
                        className={inputCls}
                        placeholder="PT"
                        maxLength={2}
                      />
                      <input
                        value={newAddr.apartment}
                        onChange={(e) => setNewAddr((a) => ({ ...a, apartment: e.target.value }))}
                        className={inputCls}
                        placeholder="Porta / apartamento"
                      />
                      <input
                        value={newAddr.address_obs}
                        onChange={(e) => setNewAddr((a) => ({ ...a, address_obs: e.target.value }))}
                        className={`${inputCls} sm:col-span-2`}
                        placeholder="Notas ao estafeta (opcional)"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={addrSaving || !newAddr.street_name.trim() || !newAddr.postal_code.trim()}
                      onClick={handleAddSavedAddress}
                      className="text-sm font-bold bg-zinc-900 text-white px-4 py-2 rounded-xl hover:bg-black disabled:opacity-40"
                    >
                      {addrSaving ? 'A guardar…' : 'Guardar morada na agenda'}
                    </button>
                  </div>
                </div>
              )}

              {modalMode === 'create' && (
                <p className="text-[10px] text-zinc-400">
                  Depois de criares o cliente, podes abrir <strong>Editar</strong> para acrescentar linhas na agenda de moradas.
                </p>
              )}

              {formError ? (
                <p className="text-red-500 text-xs font-semibold bg-red-50 px-4 py-2 rounded-xl">{formError}</p>
              ) : null}

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
                  {saving ? 'A guardar...' : modalMode === 'create' ? 'Criar' : 'Guardar ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm mx-4 p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-red-600">Eliminar cliente</h3>
              <button
                type="button"
                onClick={() => { setDeletingCustomer(null); setDeleteError(''); }}
                className="p-2 hover:bg-zinc-100 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-zinc-600 mb-2">
              Eliminar registo de <span className="font-bold text-black">{String(deletingCustomer.full_name || '')}</span>?
            </p>
            <p className="text-xs text-zinc-400 mb-6">
              Número: <code className="bg-zinc-100 px-1.5 py-0.5 rounded font-mono">{String(deletingCustomer.whatsapp_number)}</code>
              <br />
              Pedidos antigos mantêm histórico; esta ficha some da lista de clientes.
            </p>
            {deleteError ? <p className="text-red-500 text-xs font-semibold bg-red-50 px-4 py-2 rounded-xl mb-4">{deleteError}</p> : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDeletingCustomer(null); setDeleteError(''); }}
                className="flex-1 border border-gray-200 text-zinc-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-zinc-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
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
