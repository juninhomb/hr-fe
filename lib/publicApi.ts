import axios from 'axios';
import { API_BASE } from './api';

/**
 * Chamadas ao backend sob `/api/public/*` — sem JWT admin.
 *
 * Quando `PUBLIC_API_TOKEN` está definido no backend, deve existir na build do
 * dashboard **o mesmo valor** em `NEXT_PUBLIC_PUBLIC_API_TOKEN` (igual ao
 * hrstore-site). Caso contrário, paginas como `/dashboard/pdv-stripe-return`
 * recebem 403 ao confirmar a sessão Stripe após pagamento.
 */
const publicApiToken =
  typeof process.env.NEXT_PUBLIC_PUBLIC_API_TOKEN === 'string'
    ? process.env.NEXT_PUBLIC_PUBLIC_API_TOKEN.trim()
    : '';

const publicApi = axios.create({
  baseURL: `${API_BASE}/api/public`,
  timeout: 25000,
  ...(publicApiToken.length > 0
    ? { headers: { 'X-Public-Token': publicApiToken } }
    : {}),
});

export default publicApi;
