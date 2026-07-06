# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite, hot reload)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run lint       # ESLint (JS/JSX)
```

There are no automated tests — the app uses in-module self-tests via `console.assert` that run on page load (see `src/lib/hoursLogic.js`). The two exported pure functions (`sumWeek`, `allowedAfterCap`) are the only unit-testable logic.

## Architecture

This is a **client-only React 19 + Vite** app with no routing library. All state lives in a single root component.

### Component tree

```
main.jsx
└── App.jsx              (thin shell)
    └── AlocacoesApp.jsx (all state, all logic, all views)
        └── Dashboard.jsx (charts/tables for aggregated hours)
```

`AlocacoesApp.jsx` is the entire application: it owns the in-memory DB (`db` state), the active week's entries (`entries` state), ClickUp calls, Excel export, and renders the views — `lancar`, `planning`, `dashboard` — by switching on a `view` state variable.

### Data model

Rows follow this shape (both in-memory and as mapped to/from ClickUp custom fields):

```js
{
  ID, Year, ISO_Week,
  Person, Project, Business_Unit,
  Hours_Forecast, Hours_Consolidated
}
```

ClickUp is the system of record. Field IDs are mapped in `src/lib/clickup/fields.js`. All HTTP traffic to ClickUp goes through a single `cuFetch()` wrapper in `src/lib/clickup/client.js` (`BASE_URL` constant) — the app is proxy-ready.

### Persistence layers

1. **localStorage** (`ts:ui:v1`, `ts:cache:*`, `cu:token`): active week entries, UI preferences, and warm cache of ClickUp data. Loaded synchronously during `useState` initialization.
2. **ClickUp**: full historical DB. Requires an API token; today stored per-user in `localStorage('cu:token')`. Future: server-side proxy with shared token + cache.

### Styling

Tailwind utility classes are used inline throughout JSX. Global CSS variables for colors, shadows, and spacing are defined in `src/index.css`. Dark mode is toggled via `data-theme` on `<html>` and a `dark` class.

### Business rules

- Hours are integers (Forecast + Consolidated per row).
- 40h/week cap is enforced across all rows for the same person+week.
- Entries persisted in ClickUp use the ClickUp task ID as the row ID.

### Keyboard shortcuts

`?` / `Ctrl+K` — help modal, `Shift+1/2/3` — switch views (Lançar / Planejamento / Dashboard).

### Deployment

Em migração para Vercel (ver memória do projeto). O workflow GitHub Pages original (`.github/workflows/deploy.yml`) será aposentado quando o Vercel estiver em produção.
