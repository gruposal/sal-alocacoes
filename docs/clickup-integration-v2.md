---
marp: true
theme: default
paginate: true
style: |
  section {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.95rem;
    background: #fafbfc;
    color: #0f172a;
    padding: 2.2rem 3rem;
  }
  section.cover {
    background: #0f172a;
    color: #fff;
    justify-content: center;
    text-align: center;
  }
  section.cover h1 { font-size: 2.4rem; color: #fff; margin-bottom: 0.2em; }
  section.cover p { color: #94a3b8; font-size: 1rem; margin-top: 0.3em; }
  section.divider {
    background: #1e293b;
    color: #fff;
    justify-content: center;
    text-align: center;
  }
  section.divider h2 { border: none; color: #fff; font-size: 1.8rem; }
  section.divider p { color: #94a3b8; font-size: 0.95rem; }
  h2 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.3em; margin-top: 0; font-size: 1.3rem; }
  h3 { color: #475569; font-size: 1rem; margin-bottom: 0.4em; margin-top: 0.8em; }
  table { width: 100%; font-size: 0.78rem; }
  th { background: #1e293b; color: #fff; padding: 0.4em 0.7em; }
  td { padding: 0.3em 0.7em; }
  tr:nth-child(even) { background: #f1f5f9; }
  code { background: #e2e8f0; border-radius: 4px; padding: 0.1em 0.3em; font-size: 0.85em; }
  pre { background: #1e293b; color: #e2e8f0; border-radius: 8px; font-size: 0.72rem; padding: 0.9em 1.1em; line-height: 1.5; }
  blockquote { border-left: 4px solid #6366f1; background: #eef2ff; padding: 0.5em 1em; margin: 0.6em 0; border-radius: 0 6px 6px 0; color: #3730a3; font-style: normal; }
  blockquote p { margin: 0; font-size: 0.88rem; }
  ul { margin: 0.4em 0; }
  ul li { margin-bottom: 0.25em; }
  strong { color: #0f172a; }
  .tag-ok { color: #059669; font-weight: bold; }
  .tag-warn { color: #d97706; font-weight: bold; }
---

<!-- _class: cover -->

# Alocações + ClickUp v2

Modelo simplificado — horas semanais sem controle por dia

Análise · Jornada de uso · Plano técnico

---

## O que mudou em relação à v1

| | v1 (original) | v2 (simplificado) |
|---|---|---|
| **Campos numéricos** | `mon, tue, wed, thu, fri, total` | `hours` |
| **Campo data** | `week_start` | removido |
| **Total de custom fields** | 13 | **8** |
| **Grade de entrada** | 5 colunas de dias | **1 campo por linha** |
| **UI da entrada** | tabela dia × projeto | lista projeto + horas |
| **Lógica do cap 40h** | soma Mon–Fri | soma `hours` por pessoa+semana |

> A simplificação afeta o modelo de dados **e a interface** — não é só troca de banco.

---

## Visão geral

```
┌──────────────────────┐             ┌────────────────────────────────┐
│                      │             │           CLICKUP               │
│   WEBAPP             │   API v2    │                                 │
│   (React + Vite)     │◀──────────▶│  📋 Alocações Entries           │
│                      │   fetch()   │  👤 People                     │
│   UI simplificada    │             │  📁 Projects                   │
│   Lógica preservada  │             │  🏢 Business Units              │
│                      │             │                                 │
└──────────────────────┘             └────────────────────────────────┘
```

**O que muda:** banco de dados + entrada de horas (1 campo em vez de 5).  
**O que fica:** cadastros, dashboard, exportação Excel, cap de 40h.

---

## Novo modelo de dados

Cada linha do alocações:

```js
{
  ID,           // ts_id: string identificador único (base-36)
  Year,         // number
  ISO_Week,     // number (1–53)
  Person,       // string
  Project,      // string
  Business_Unit,// string
  Hours,        // integer — horas totais na semana para esse projeto
  Notes         // string
}
```

**Removidos:** `Week_Start`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Total`  
**Adicionado:** `Hours` (substitui todos os anteriores)

---

## Como fica no ClickUp

Cada linha do alocações vira uma task:

```
📌 2026-W05 | Alice Silva | Branding / Google Brand Film
   ├── person:        Alice Silva
   ├── project:       Google – Brand Film
   ├── business_unit: Branding
   ├── year:          2026
   ├── iso_week:      5
   ├── hours:         32
   └── notes:         ""
```

Mais limpo que a v1 — sem campos `mon/tue/wed/thu/fri` redundantes.  
O gestor vê as horas totais por projeto/semana diretamente no ClickUp.

---

## Custom fields — de 13 para 8

**List `Alocações Entries`:**

| Campo | Tipo ClickUp | Observação |
|---|---|---|
| `ts_id` | Text | chave de upsert |
| `person` | Text | |
| `project` | Text | |
| `business_unit` | Text | |
| `year` | Number | |
| `iso_week` | Number | |
| `hours` | Number | substitui mon+tue+wed+thu+fri+total |
| `notes` | Text | |

**Lists `People`, `Projects`, `Business Units`:** sem campos — só o nome da task.

---

<!-- _class: divider -->

## Jornada do Colaborador

_"Vou lançar minhas horas da semana"_

---

## Colaborador — passo a passo

```
1. Abre o app
   └── App busca people/projects/BUs no ClickUp  →  3 requisições

2. Seleciona o próprio nome e a semana atual
   └── App busca entradas da semana               →  1 requisição

3. Preenche horas por projeto (ex: 3 linhas)
   ├── Linha 1: Google Brand Film  →  32h
   ├── Linha 2: Overhead           →   8h
   └── Tudo local, sem API

4. Clica "Salvar"
   └── Para cada linha:
       - No cache (semana já foi carregada) → 1 PUT por linha
       - Linha nova                         → 1 POST por linha
   └── ~3–6 requisições para 3 linhas

5. Pronto. Tasks aparecem no ClickUp.
```

**Total típico na sessão: ~7–10 requisições.** Dentro do limite Free.

---

## Interface de entrada — o que muda na UI

**v1 (atual):** grade com colunas Mon/Tue/Wed/Thu/Fri por projeto

```
Projeto            | Seg | Ter | Qua | Qui | Sex | Total
Google Brand Film  |  8  |  8  |  8  |  8  |  0  |  32
Overhead           |  2  |  2  |  2  |  2  |  0  |   8
```

**v2 (novo):** lista com projeto + horas semanais

```
Projeto            | Horas (semana)
Google Brand Film  |      32
Overhead           |       8
─────────────────────────────────
Total              |      40  ✅
```

> Mais simples de preencher. Cap de 40h ainda é verificado — agora somando a coluna `Hours`.

---

<!-- _class: divider -->

## Jornada do Gestor

_"Quero ver como as horas estão distribuídas"_

---

## Gestor — dois modos de acesso

**Via app (Dashboard):**
1. Abre o app → clica "Carregar Ano"
2. App busca entradas dos últimos 365 dias (paginado, 100/página)
3. Dashboard agrega client-side: por pessoa, projeto, BU, semana
4. Resultado: gráficos e tabelas — **lógica de agregação não muda**

**Direto no ClickUp (sem abrir o app):**
- View filtrada por `person`, `project` ou `iso_week`
- Campo `hours` já é o total semanal — sem precisar somar colunas
- Mais legível que a v1 (não tem 5 colunas de dias)

> Com o modelo simplificado, o ClickUp fica ainda mais legível para o gestor.

---

## Gestor — tempo de carregamento

"Carregar Ano" com modelo simplificado:

```
2.000 registros ÷ 100 por página = 20 requisições sequenciais
~250ms por requisição × 20 = ~5–8 segundos
```

Igual à v1 — o número de registros não muda, só o shape de cada um.

**Como lidar (igual à v1):**
- Barra de progresso com contador de páginas
- Operação rara (não é fluxo diário)

---

<!-- _class: divider -->

## Arquitetura Técnica

---

## Estrutura do código

**4 arquivos novos** (camada ClickUp):

```
src/lib/clickup/
├── client.js    → fetch base: auth, retry em 429, delay 50ms entre calls
├── fields.js    → auto-descobre 8 UUIDs dos custom fields (1x no startup)
├── entries.js   → loadForWeek · loadLastYear · upsertMany · deleteRow · updateRow
└── lists.js     → loadAll · addItem · renameItem · deleteItem
```

**3 arquivos modificados** (v1 tinha 2):

```
src/AlocaçõesApp.jsx  → 6 funções Supabase → 6 chamadas ClickUp
                      → UI de entrada: grade → lista com campo "hours"
src/Directory.jsx     → 4 funções Supabase → 4 chamadas ClickUp
```

> `AlocaçõesApp.jsx` requer um pouco mais de trabalho na v2 — a UI de entrada muda, não só a camada de dados.

---

## O que não muda

```
Dashboard.jsx    → agrega por 'hours' em vez de 'Total', lógica idêntica
App.jsx          → sem mudanças
main.jsx         → sem mudanças
App.css          → sem mudanças
index.css        → sem mudanças
vite.config.js   → sem mudanças
```

A lógica do Dashboard usa `row.Total` atualmente.
Na v2, passa a usar `row.Hours` — **uma linha de mudança por agregação**.

---

## Upsert sem suporte nativo — solução (igual à v1)

```js
// Cache: ts_id → clickup_task_id (vive durante a sessão)
const taskIdCache = new Map();

// Após qualquer leitura de semana ou ano:
tasks.forEach(t => taskIdCache.set(getField(t, 'ts_id'), t.id));

// Ao salvar:
async function upsertRow(row) {
  const cachedId = taskIdCache.get(row.ID);
  if (cachedId) {
    await updateTask(cachedId, { hours: row.Hours, notes: row.Notes });
  } else {
    const t = await createTask(row);   // nome + todos os 8 campos inline
    taskIdCache.set(row.ID, t.id);
  }
}
```

Update na v2 é mais leve: só 2 campos variáveis (`hours`, `notes`) em vez de 7.

---

## Auto-descoberta dos field UUIDs

Igual à v1, mas com 8 campos em vez de 13:

```js
async function discoverFields() {
  const cached = localStorage.getItem('cu:fields:v2');
  if (cached) return JSON.parse(cached);

  const res = await cuFetch(`/list/${LIST_ENTRIES}/field`);
  const map = Object.fromEntries(res.fields.map(f => [f.name, f.id]));
  localStorage.setItem('cu:fields:v2', JSON.stringify(map));
  return map;
}
```

Campos a criar no ClickUp com esses nomes exatos:
`ts_id · person · project · business_unit · year · iso_week · hours · notes`

> Cache key mudou para `cu:fields:v2` — evita conflito se a v1 chegou a rodar.

---

## Variáveis de ambiente — sem mudança

```bash
VITE_CLICKUP_TOKEN=pk_...           # Token pessoal da conta ClickUp
VITE_CLICKUP_LIST_ENTRIES=...       # ID da List "Alocações Entries"
VITE_CLICKUP_LIST_PEOPLE=...        # ID da List "People"
VITE_CLICKUP_LIST_PROJECTS=...      # ID da List "Projects"
VITE_CLICKUP_LIST_BUS=...           # ID da List "Business Units"
```

Continua 5 variáveis — igual à v1.

---

## Setup no ClickUp (antes de codificar)

**O que criar manualmente (~10 min — menos que a v1):**

1. Um **Space** ou **Folder** dedicado (ex: _"Alocações"_)
2. 4 **Lists:** `Alocações Entries`, `People`, `Projects`, `Business Units`
3. Na list `Alocações Entries`, 8 campos com os **nomes exatos:**

| Campos texto | Campos número |
|---|---|
| `ts_id`, `person`, `project`, `business_unit`, `notes` | `year`, `iso_week`, `hours` |

> 5 campos a menos que a v1. Setup mais rápido, lista mais limpa no ClickUp.

---

## Plano de implementação

| Fase | O que fazer | v1 vs v2 |
|---|---|---|
| **1. Setup ClickUp** | Criar lists + 8 campos | Mais simples (era 13) |
| **2. `client.js`** | fetch base, auth, retry 429 | Igual |
| **3. `fields.js`** | auto-descoberta de 8 field IDs | Igual |
| **4. `entries.js`** | operações de leitura/escrita | Mais simples (sem dias) |
| **5. `lists.js`** | CRUD de people/projects/BUs | Igual |
| **6. `AlocaçõesApp.jsx`** | trocar Supabase + refazer UI de entrada | **Mais trabalho** |
| **7. `Dashboard.jsx`** | `row.Total` → `row.Hours` | Novo (não havia na v1) |
| **8. `Directory.jsx`** | trocar 4 chamadas Supabase | Igual |
| **9. Testes** | fluxo completo colaborador e gestor | — |

A fase crítica continua sendo **`entries.js`** + **`AlocaçõesApp.jsx`** (UI de entrada).

---

## Limitações — igual à v1

| Limitação | Impacto | Mitigação |
|---|---|---|
| Token pessoal (sem RLS) | Baixo — uso interno | Só deploy privado/intranet |
| "Carregar Ano" lento (5–8s) | Gestor, uso raro | Barra de progresso |
| Sem deploy público seguro | Estrutural | Rede interna ou Cloudflare Access |

> Na v2, "editar linha = N campos" ficou menor — update manda só `hours` + `notes`.

---

<!-- _class: cover -->

## Resumo v2

**Modelo simplificado:** 8 campos em vez de 13 — sem Mon/Tue/Wed/Thu/Fri

**Para o colaborador:** entrada mais rápida — 1 número por projeto

**Para o gestor:** ClickUp mais legível — campo `hours` direto, sem somar dias

**Custo da simplificação:** UI de entrada precisa ser refeita em `AlocaçõesApp.jsx`

---

4 listas ClickUp · **8 custom fields** · 4 arquivos novos · **3 modificados**
