'use client';

import React, { useEffect, useState } from 'react';
import {
  Euro, Percent, Plus, Power, RefreshCw, Save, Tag, Trash2, X, Pencil,
} from 'lucide-react';
import api from '../../../lib/api';

type DiscountCoupon = {
  id: number;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type CouponForm = {
  id?: number;
  code: string;
  kind: 'percent' | 'fixed';
  value: string;
  is_active: boolean;
};

const EMPTY: CouponForm = {
  code: '',
  kind: 'percent',
  value: '10',
  is_active: true,
};

export default function DiscountCouponsSection() {
  const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<CouponForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DiscountCoupon | null>(null);

  const fetchCoupons = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<DiscountCoupon[]>('/discount-coupons');
      setCoupons(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Não foi possível carregar os cupões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCoupons();
  }, []);

  const startCreate = () => { setError(''); setEditing({ ...EMPTY }); };
  const startEdit = (c: DiscountCoupon) => {
    setError('');
    setEditing({
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: String(c.value),
      is_active: c.is_active,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');
    const body = {
      code: editing.code.trim().toUpperCase(),
      kind: editing.kind,
      value: editing.value.replace(',', '.'),
      is_active: editing.is_active,
    };
    try {
      if (editing.id) {
        await api.put(`/discount-coupons/${editing.id}`, body);
      } else {
        await api.post('/discount-coupons', body);
      }
      setEditing(null);
      await fetchCoupons();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erro ao gravar o cupão.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: DiscountCoupon) => {
    try {
      await api.put(`/discount-coupons/${c.id}`, {
        code: c.code,
        kind: c.kind,
        value: String(c.value),
        is_active: !c.is_active,
      });
      await fetchCoupons();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erro ao alterar estado.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/discount-coupons/${confirmDelete.id}`);
      setConfirmDelete(null);
      await fetchCoupons();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erro ao apagar cupão.');
    }
  };

  return (
    <section className="bg-white rounded-3xl border border-black/5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-black/5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#F5EFE6] text-clay-600">
              <Tag size={16} />
            </span>
            <h3 className="text-lg font-bold tracking-tight">Cupões de desconto</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-2xl">
            Códigos aplicáveis no checkout do site. O desconto incide apenas sobre o subtotal dos
            artigos (não sobre portes). Se não existir nenhum cupão ativo aqui, o servidor pode
            ainda aceitar cupões definidos em{' '}
            <code className="text-[10px] bg-zinc-100 px-1 rounded">HRSTORE_DISCOUNT_COUPONS</code>{' '}
            no ambiente (fallback).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchCoupons()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 px-3 py-2 rounded-full border border-black/10 hover:border-black disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-black text-white px-3 py-2 rounded-full hover:bg-zinc-800"
          >
            <Plus size={14} /> Novo cupão
          </button>
        </div>
      </div>

      {error && !editing && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr className="border-b border-black/5">
              <th className="px-4 py-3 text-left font-bold">Código</th>
              <th className="px-4 py-3 text-left font-bold">Tipo</th>
              <th className="px-4 py-3 text-right font-bold">Valor</th>
              <th className="px-4 py-3 text-left font-bold">Estado</th>
              <th className="px-4 py-3 text-right font-bold">—</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-black/5 hover:bg-[#FBF8F4]/60">
                <td className="px-4 py-3">
                  <code className="text-xs font-black bg-[#FBF8F4] border border-black/10 px-2 py-0.5 rounded">
                    {c.code}
                  </code>
                </td>
                <td className="px-4 py-3">
                  {c.kind === 'percent' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700">
                      <Percent size={12} /> Percentagem
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                      <Euro size={12} /> Valor fixo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold">
                  {c.kind === 'percent' ? `${c.value} %` : `€ ${Number(c.value).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggleActive(c)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      c.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                    }`}
                  >
                    <Power size={10} /> {c.is_active ? 'ativo' : 'inativo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      title="Editar"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-black/10 hover:border-black text-zinc-600"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(c)}
                      title="Apagar"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-black/10 hover:border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!coupons.length && !loading && (
              <tr>
                <td colSpan={5} className="text-center text-zinc-500 text-sm py-12">
                  Sem cupões. Clica em <strong>Novo cupão</strong> para criar ou usa o fallback por
                  env no backend.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <h4 className="text-lg font-bold tracking-tight">
                {editing.id ? 'Editar cupão' : 'Novo cupão'}
              </h4>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-2 -m-2 hover:bg-zinc-100 rounded-xl"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block">
                <span className="text-xs font-bold text-zinc-700">Código *</span>
                <input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="VERAO2026"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-zinc-700">Tipo *</span>
                <select
                  value={editing.kind}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      kind: e.target.value as 'percent' | 'fixed',
                    })
                  }
                  className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="percent">Percentagem sobre artigos</option>
                  <option value="fixed">Euros fixos sobre artigos</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-zinc-700">
                  {editing.kind === 'percent' ? 'Percentagem (%) *' : 'Valor (€) *'}
                </span>
                <input
                  value={editing.value}
                  onChange={(e) => setEditing({ ...editing, value: e.target.value.replace(',', '.') })}
                  inputMode="decimal"
                  className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder={editing.kind === 'percent' ? '10' : '5.00'}
                />
              </label>
              <label className="flex items-start gap-2.5 select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-black/20 accent-black"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                <span className="text-sm font-bold text-zinc-700">Cupão ativo (aceite no site)</span>
              </label>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-black/5 bg-[#FBF8F4]/60 rounded-b-[28px]">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-zinc-700 bg-white border border-black/10 hover:border-black"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || editing.code.trim().length < 2 || !editing.value.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-black text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? 'A gravar…' : (
                  <>
                    <Save size={14} /> Gravar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-sm p-6">
            <h4 className="text-base font-bold">Apagar cupão?</h4>
            <p className="mt-2 text-sm text-zinc-600">
              O código <strong>{confirmDelete.code}</strong> deixa de funcionar no checkout.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-full text-xs font-bold text-zinc-700 border border-black/10 hover:border-black"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
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
