'use client';
import React, { useEffect, useState } from 'react';
import {
  Plus, RefreshCw, Save, Trash2, Truck, Globe, X, Pencil, Power, MessageCircle,
} from 'lucide-react';
import api from '../../../lib/api';
import CategoriesSection from './CategoriesSection';
import DiscountCouponsSection from './DiscountCouponsSection';

type ShippingZone = {
  id: number;
  country_code: string;
  region: string | null;
  label: string;
  fee_eur: number;
  free_above_eur: number | null;
  postal_code_prefix: string | null;
  sort_order: number;
  is_active: boolean;
  requires_whatsapp_checkout: boolean;
  updated_at?: string;
};

type FormState = {
  id?: number;
  country_code: string;
  region: string;
  label: string;
  fee_eur: string;
  free_above_eur: string;
  postal_code_prefix: string;
  sort_order: string;
  is_active: boolean;
  requires_whatsapp_checkout: boolean;
};

const EMPTY_FORM: FormState = {
  country_code: 'PT',
  region: '',
  label: '',
  fee_eur: '5.00',
  free_above_eur: '',
  postal_code_prefix: '',
  sort_order: '100',
  is_active: true,
  requires_whatsapp_checkout: false,
};

export default function SettingsTab() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ShippingZone | null>(null);

  const fetchZones = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<ShippingZone[]>('/shipping-zones');
      setZones(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Não foi possível carregar as tarifas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchZones(); }, []);

  const startCreate = () => setEditing({ ...EMPTY_FORM });
  const startEdit = (z: ShippingZone) =>
    setEditing({
      id: z.id,
      country_code: z.country_code,
      region: z.region ?? '',
      label: z.label,
      fee_eur: String(z.fee_eur),
      free_above_eur: z.free_above_eur != null ? String(z.free_above_eur) : '',
      postal_code_prefix: z.postal_code_prefix ?? '',
      sort_order: String(z.sort_order),
      is_active: z.is_active,
      requires_whatsapp_checkout: z.requires_whatsapp_checkout,
    });

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError('');

    const body = {
      country_code: editing.country_code.trim().toUpperCase(),
      region: editing.region.trim() || null,
      label: editing.label.trim(),
      fee_eur: editing.fee_eur,
      free_above_eur: editing.free_above_eur === '' ? null : editing.free_above_eur,
      postal_code_prefix: editing.postal_code_prefix.trim(),
      sort_order: editing.sort_order,
      is_active: editing.is_active,
      requires_whatsapp_checkout: editing.requires_whatsapp_checkout,
    };

    try {
      if (editing.id) {
        await api.put(`/shipping-zones/${editing.id}`, body);
      } else {
        await api.post('/shipping-zones', body);
      }
      setEditing(null);
      await fetchZones();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao gravar a zona.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (z: ShippingZone) => {
    try {
      await api.put(`/shipping-zones/${z.id}`, { is_active: !z.is_active });
      await fetchZones();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao alterar estado.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/shipping-zones/${confirmDelete.id}`);
      setConfirmDelete(null);
      await fetchZones();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao apagar zona.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Categorias do site (com upload de imagem) */}
      <CategoriesSection />

      {/* Cupões de desconto (checkout site) */}
      <DiscountCouponsSection />

      {/* Cabeçalho da secção */}
      <section className="bg-white rounded-3xl border border-black/5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-5 border-b border-black/5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-[#F5EFE6] text-clay-600">
                <Truck size={16} />
              </span>
              <h3 className="text-lg font-bold tracking-tight">Tarifas de envio</h3>
            </div>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-2xl">
              Configurações usadas pelo site público no checkout. O servidor recalcula sempre o frete
              a partir desta tabela — o cliente não consegue alterar valores.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchZones}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 px-3 py-2 rounded-full border border-black/10 hover:border-black disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
            <button
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-black text-white px-3 py-2 rounded-full hover:bg-zinc-800"
            >
              <Plus size={14} /> Nova zona
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
              <tr className="border-b border-black/5">
                <Th>País</Th>
                <Th>Zona</Th>
                <Th>Prefixo CP</Th>
                <Th right>Frete</Th>
                <Th right>Grátis acima de</Th>
                <Th>Checkout</Th>
                <Th right>Ordem</Th>
                <Th>Estado</Th>
                <Th right>—</Th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-black/5 hover:bg-[#FBF8F4]/60">
                  <Td>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold">
                      <Globe size={12} className="text-zinc-400" /> {z.country_code}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-bold">{z.label}</p>
                    {z.region && <p className="text-[11px] text-zinc-500">{z.region}</p>}
                  </Td>
                  <Td>
                    {z.postal_code_prefix ? (
                      <code className="text-xs bg-[#FBF8F4] border border-black/10 px-1.5 py-0.5 rounded">
                        {z.postal_code_prefix}*
                      </code>
                    ) : (
                      <span className="text-[11px] text-zinc-400">catch-all</span>
                    )}
                  </Td>
                  <Td right>
                    <span className="font-mono font-bold">€{z.fee_eur.toFixed(2)}</span>
                  </Td>
                  <Td right>
                    {z.free_above_eur != null ? (
                      <span className="font-mono text-xs">€{Number(z.free_above_eur).toFixed(2)}</span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {z.requires_whatsapp_checkout ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <MessageCircle size={10} /> WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border bg-zinc-50 text-zinc-600 border-zinc-200">
                        Site
                      </span>
                    )}
                  </Td>
                  <Td right>
                    <span className="text-xs text-zinc-500 font-mono">{z.sort_order}</span>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => toggleActive(z)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        z.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }`}
                      title="Clica para alternar"
                    >
                      <Power size={10} /> {z.is_active ? 'ativa' : 'inativa'}
                    </button>
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton onClick={() => startEdit(z)} title="Editar">
                        <Pencil size={13} />
                      </IconButton>
                      <IconButton
                        onClick={() => setConfirmDelete(z)}
                        title="Apagar"
                        variant="danger"
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
              {!zones.length && !loading && (
                <tr>
                  <td colSpan={9} className="text-center text-zinc-500 text-sm py-12">
                    Sem zonas configuradas. Carrega em <strong>Nova zona</strong> para criar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Criar/Editar */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <h4 className="text-lg font-bold tracking-tight">
                {editing.id ? 'Editar zona' : 'Nova zona de envio'}
              </h4>
              <button
                onClick={() => setEditing(null)}
                className="p-2 -m-2 hover:bg-zinc-100 rounded-xl"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid sm:grid-cols-[140px_1fr] gap-3">
                <FormField
                  label="País (ISO 2)"
                  value={editing.country_code}
                  onChange={(v) => setEditing({ ...editing, country_code: v.toUpperCase().slice(0, 2) })}
                  placeholder="PT"
                  hint="PT, ES, EU, …"
                />
                <FormField
                  label="Etiqueta visível *"
                  value={editing.label}
                  onChange={(v) => setEditing({ ...editing, label: v })}
                  placeholder="Portugal Continental"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  label="Região (opcional)"
                  value={editing.region}
                  onChange={(v) => setEditing({ ...editing, region: v })}
                  placeholder="Continental, Madeira/Açores…"
                />
                <FormField
                  label="Prefixo do CP"
                  value={editing.postal_code_prefix}
                  onChange={(v) => setEditing({ ...editing, postal_code_prefix: v })}
                  placeholder="9 (para Madeira/Açores)"
                  hint="Vazio = catch-all do país."
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <FormField
                  label="Frete (€) *"
                  value={editing.fee_eur}
                  onChange={(v) => setEditing({ ...editing, fee_eur: v.replace(',', '.') })}
                  placeholder="5.00"
                  inputMode="decimal"
                />
                <FormField
                  label="Grátis acima de (€)"
                  value={editing.free_above_eur}
                  onChange={(v) => setEditing({ ...editing, free_above_eur: v.replace(',', '.') })}
                  placeholder="opcional"
                  inputMode="decimal"
                />
                <FormField
                  label="Ordem"
                  value={editing.sort_order}
                  onChange={(v) => setEditing({ ...editing, sort_order: v.replace(/\D/g, '') || '0' })}
                  placeholder="100"
                  inputMode="numeric"
                  hint="Menor = mais cima."
                />
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-2.5 select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-black/20 accent-black"
                    checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  />
                  <span>
                    <span className="text-sm font-bold text-zinc-700 block">
                      Zona ativa (visível no checkout)
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Desativar oculta esta zona do site sem perder o histórico.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 select-none">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-black/20 accent-emerald-600"
                    checked={editing.requires_whatsapp_checkout}
                    onChange={(e) => setEditing({ ...editing, requires_whatsapp_checkout: e.target.checked })}
                  />
                  <span>
                    <span className="text-sm font-bold text-zinc-700 inline-flex items-center gap-1.5">
                      <MessageCircle size={13} className="text-emerald-600" />
                      Checkout só via WhatsApp
                    </span>
                    <span className="text-[11px] text-zinc-500 block">
                      Para esta zona, o site não cria pedidos: o cliente é encaminhado
                      para a conversa de WhatsApp para combinar frete, prazos e pagamento.
                      Recomendado para destinos internacionais.
                    </span>
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-black/5 bg-[#FBF8F4]/60 rounded-b-[28px]">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-5 py-2.5 rounded-full text-sm font-bold text-zinc-700 bg-white border border-black/10 hover:border-black"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.country_code || !editing.label || !editing.fee_eur}
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
            <h4 className="text-base font-bold">Apagar zona?</h4>
            <p className="mt-2 text-sm text-zinc-600">
              Vais remover <strong>{confirmDelete.label}</strong> ({confirmDelete.country_code}).
              Pedidos antigos com referência a esta zona ficam preservados.
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
    </div>
  );
}

// =============================================================
// Helpers
// =============================================================

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 font-bold ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-4 py-3 align-middle ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  );
}

function IconButton({
  children, onClick, title, variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  variant?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-full border border-black/10 hover:border-black transition ${
        variant === 'danger' ? 'text-red-600 hover:bg-red-50 hover:border-red-300' : 'text-zinc-600'
      }`}
    >
      {children}
    </button>
  );
}

function FormField({
  label, value, onChange, placeholder, hint, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-zinc-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1.5 block w-full px-3 py-2 rounded-xl bg-[#FBF8F4] border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      {hint && <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}
