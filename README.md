# SAL-Alocações – Horas Semanais (React + Vite)

Aplicativo client-side para lançamento semanal de horas por colaborador e projeto, com integração ao ClickUp como banco de dados.

## Instalação e desenvolvimento

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build      # gera dist/
npm run preview    # serve dist/ localmente
```

## Configuração

Token ClickUp: a aplicação lê de `localStorage('cu:token')` (via UI de configurações) ou de `VITE_CLICKUP_TOKEN` no build. IDs de listas e campos custom estão em `src/lib/clickup/fields.js`.

## Estrutura

- `src/AlocacoesApp.jsx` — componente principal, todas as views (Lançar / Planejamento / Dashboard).
- `src/Dashboard.jsx` — agregações e gráficos.
- `src/lib/clickup/` — cliente HTTP, mapeamento de campos e endpoints.
- `src/lib/hoursLogic.js` — funções puras com self-tests (`sumWeek`, `allowedAfterCap`).

## Deploy

Em migração para Vercel. O workflow GitHub Pages original será aposentado quando o Vercel estiver em produção.
