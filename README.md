# HR Store — Admin (backoffice)

Next.js (App Router). Em desenvolvimento fala com o API em `hr-be` na porta **3001**.

## Desenvolvimento local

1. Na pasta `hr-be`, garante `.env` com `PORT=3001`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USER` / `ADMIN_PASS`, etc. (ver `hr-be/.env.example`).
2. Arranca o backend: `npm run dev` (dentro de `hr-be`).
3. Na pasta `hr-fe`:
   - O ficheiro **`.env.development`** já aponta `NEXT_PUBLIC_API_URL` para `http://localhost:3001`.
   - Se o backend tiver **`PUBLIC_API_TOKEN`** definido, cria **`.env.development.local`** (podes copiar de `.env.development.local.example`) e define **`NEXT_PUBLIC_PUBLIC_API_TOKEN`** com o mesmo valor — necessário para rotas como `/dashboard/pdv-stripe-return` e outras chamadas a `/api/public/*`.
4. `npm install` e `npm run dev` — abre [http://localhost:3000](http://localhost:3000) e faz login com as credenciais admin do `hr-be`.

Origens `http://localhost:3000` e `http://127.0.0.1:3000` já estão permitidas no CORS do backend.

Para variáveis adicionais, vê **`.env.example`**.

## Produção

Define `NEXT_PUBLIC_API_URL` (e token público se aplicável) no ambiente de deploy ou em `.env.production` — não commits de segredos.
