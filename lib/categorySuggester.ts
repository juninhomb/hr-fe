/**
 * Sugere automaticamente uma categoria com base no prefixo do nome do produto.
 *
 * Espelha a lógica da migration `2026-04-30_categorize_products.sql` para que
 * o que o admin vê no formulário coincida com o que a DB faria.
 *
 * Devolve `null` se não encontrar match — neste caso o admin escolhe à mão.
 */

type CategoryLite = { id: number; name: string };

// Padrão → nome canónico da categoria (case-insensitive, acentos opcionais).
// Ordem importa — primeiros matches ganham. Mais específico → mais cedo.
const RULES: Array<{ test: RegExp; categoryName: string }> = [
  // Conjuntos vêm primeiro para evitar que "Conjunto Trico" seja apanhado
  // por uma futura regra "Tricot".
  { test: /^conjunto/i,           categoryName: 'Conjuntos' },
  { test: /^vestido/i,            categoryName: 'Vestidos' },
  { test: /^macac/i,              categoryName: 'Macacões' },     // macacão / macacao
  { test: /^(biquini|maio)/i,     categoryName: 'Biquinis' },     // biquíni / biquini / maiô / maio
  { test: /^body/i,               categoryName: 'Bodies' },
  { test: /^(calca|bermuda)/i,    categoryName: 'Calças' },       // calça / calca / bermuda
  { test: /^short/i,              categoryName: 'Shorts' },
  { test: /^blusa/i,              categoryName: 'Blusas' },
  { test: /^lenco/i,              categoryName: 'Acessórios' },   // lenço / lenco
];

/**
 * Normaliza string para comparação: remove acentos e baixa o case.
 * Ex.: "Biquíni Olho Grego" → "biquini olho grego"
 */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Devolve o id da categoria sugerida (a partir da lista de categorias
 * existentes) ou `null` se nenhuma regra fizer match — ou se a categoria
 * sugerida não existir na lista carregada.
 */
export function suggestCategoryId(
  productName: string,
  categories: CategoryLite[]
): number | null {
  const name = stripAccents((productName || '').trim().toLowerCase());
  if (!name) return null;

  for (const rule of RULES) {
    if (rule.test.test(name)) {
      const match = categories.find(
        (c) => stripAccents(c.name.toLowerCase()) === stripAccents(rule.categoryName.toLowerCase())
      );
      if (match) return match.id;
    }
  }
  return null;
}
