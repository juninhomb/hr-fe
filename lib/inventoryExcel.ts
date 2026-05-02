import * as XLSX from 'xlsx';

export type InventoryImportRowPayload = {
  sku: string;
  variant_id?: number;
  product_id?: number;
  name?: string;
  base_price?: number;
  stock?: number;
  color?: string;
  size?: string;
  category_name?: string;
  category_id?: number;
  variant_is_active?: boolean;
  is_featured?: boolean;
};

/** Remove BOM / trim / lower-case para comparar cabeçalhos Excel */
export function normInventoryHeader(s: string): string {
  return String(s).replace(/^\uFEFF/, '').trim().toLowerCase();
}

const CANONICAL_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['variant_id', ['id variante']],
  ['product_id', ['id produto']],
  ['name', ['produto']],
  ['color', ['cor']],
  ['size', ['tamanho']],
  ['category_name', ['categoria']],
  ['sku', ['sku']],
  ['base_price', ['preço (€)', 'preço (euro)', 'preço', 'preco (€)', 'preco', 'preco (eur)']],
  ['stock', ['stock']],
  ['variant_is_active', ['visível na loja', 'visivel na loja']],
  ['is_featured', ['destaque']],
] as const;

export function buildInventoryColumnMap(headers: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const normalized = headers.map((raw) => ({ raw, n: normInventoryHeader(raw) }));
  for (const [canonical, aliases] of CANONICAL_ALIASES) {
    for (const al of aliases) {
      const na = normInventoryHeader(al);
      const hit = normalized.find((x) => x.n === na);
      if (hit) {
        map.set(canonical, hit.raw);
        break;
      }
    }
  }
  return map;
}

export function validateInventoryColumnMap(colMap: Map<string, string>): string | null {
  if (!colMap.has('sku')) {
    return 'A folha tem de incluir a coluna «SKU» (idealmente use o ficheiro exportado).';
  }
  return null;
}

export function parseInventoryPtBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number' && !Number.isNaN(v)) {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  const s = String(v ?? '').trim().toLowerCase();
  if (['sim', 's', 'yes', 'true', '1', 'verdadeiro'].includes(s)) return true;
  if (['não', 'nao', 'n', 'no', 'false', '0', 'falso'].includes(s)) return false;
  return undefined;
}

function numFromCell(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
}

/**
 * Converte linhas do sheet_to_json em payloads para POST /products/import.
 * Só inclui chaves de colunas presentes no mapa (cabeçalhos reconhecidos).
 */
export function sheetRowsToImportPayloads(
  rows: Record<string, unknown>[],
  colMap: Map<string, string>
): { payloads: InventoryImportRowPayload[]; errors: { sheetRow: number; reason: string }[] } {
  const payloads: InventoryImportRowPayload[] = [];
  const errors: { sheetRow: number; reason: string }[] = [];
  const seenSkus = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sheetRow = i + 2;

    const get = (canonical: string): unknown => {
      const hk = colMap.get(canonical);
      if (!hk) return undefined;
      if (!(hk in row)) return undefined;
      return row[hk];
    };

    const skuRaw = get('sku');
    const sku = String(skuRaw ?? '').trim().toUpperCase();

    const meaningfulKeys = [...colMap.values()].filter((hk) => {
      const v = row[hk];
      return v !== '' && v !== null && v !== undefined;
    });
    if (!sku && meaningfulKeys.length === 0) continue;

    if (!sku) {
      errors.push({ sheetRow, reason: 'SKU em falta' });
      continue;
    }

    if (seenSkus.has(sku)) {
      errors.push({ sheetRow, reason: 'SKU duplicado no ficheiro' });
      continue;
    }
    seenSkus.add(sku);

    const payload: InventoryImportRowPayload = { sku };

    if (colMap.has('variant_id')) {
      const vid = get('variant_id');
      if (vid !== '' && vid !== undefined && vid !== null) {
        const n = Number(vid);
        if (Number.isFinite(n)) payload.variant_id = n;
      }
    }

    if (colMap.has('product_id')) {
      const pid = get('product_id');
      if (pid !== '' && pid !== undefined && pid !== null) {
        const n = Number(pid);
        if (Number.isFinite(n)) payload.product_id = n;
      }
    }

    if (colMap.has('name')) {
      const name = String(get('name') ?? '').trim();
      if (!name) {
        errors.push({ sheetRow, reason: 'Nome do produto vazio' });
        continue;
      }
      payload.name = name;
    }

    if (colMap.has('base_price')) {
      const n = numFromCell(get('base_price'));
      if (!Number.isFinite(n) || n < 0) {
        errors.push({ sheetRow, reason: 'Preço (€) inválido' });
        continue;
      }
      payload.base_price = n;
    }

    if (colMap.has('stock')) {
      const n = Math.round(numFromCell(get('stock')));
      if (!Number.isFinite(n) || n < 0) {
        errors.push({ sheetRow, reason: 'Stock inválido' });
        continue;
      }
      payload.stock = n;
    }

    if (colMap.has('color')) {
      payload.color = String(get('color') ?? '').trim();
    }

    if (colMap.has('size')) {
      payload.size = String(get('size') ?? '').trim();
    }

    if (colMap.has('category_name')) {
      payload.category_name = String(get('category_name') ?? '').trim();
    }

    if (colMap.has('variant_is_active')) {
      const b = parseInventoryPtBool(get('variant_is_active'));
      if (b === undefined) {
        errors.push({ sheetRow, reason: '«Visível na loja» inválido (use Sim ou Não)' });
        continue;
      }
      payload.variant_is_active = b;
    }

    if (colMap.has('is_featured')) {
      const b = parseInventoryPtBool(get('is_featured'));
      if (b === undefined) {
        errors.push({ sheetRow, reason: '«Destaque» inválido (use Sim ou Não)' });
        continue;
      }
      payload.is_featured = b;
    }

    payloads.push(payload);
  }

  return { payloads, errors };
}

export function parseInventoryImportWorkbook(ab: ArrayBuffer): {
  payloads: InventoryImportRowPayload[];
  parseErrors: { sheetRow: number; reason: string }[];
  mapError: string | null;
} {
  const wb = XLSX.read(ab, { type: 'array' });
  if (!wb.SheetNames?.length) {
    return { payloads: [], parseErrors: [], mapError: 'Workbook sem folhas' };
  }
  const sheetName = wb.SheetNames.includes('Inventário') ? 'Inventário' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { payloads: [], parseErrors: [], mapError: 'Folha não encontrada' };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  if (!rows.length) {
    return { payloads: [], parseErrors: [], mapError: 'Sem linhas de dados' };
  }

  const headers = Object.keys(rows[0]);
  const colMap = buildInventoryColumnMap(headers);
  const mapError = validateInventoryColumnMap(colMap);
  if (mapError) return { payloads: [], parseErrors: [], mapError };

  const { payloads, errors } = sheetRowsToImportPayloads(rows, colMap);
  return { payloads, parseErrors: errors, mapError: null };
}
