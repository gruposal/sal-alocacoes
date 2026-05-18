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
  .caption { font-size: 0.75rem; color: #64748b; margin-top: 0.3em; }
---

<!-- _class: cover -->

# Alocações + ClickUp v3

Previsão de início de semana + Consolidado de fim de semana

Modelo de dados · Layout · Plano técnico

---

## O que mudou em relação à v2

| | v2 | v3 |
|---|---|---|
| **Campos de horas** | `hours` (1 campo) | `hours_forecast` + `hours_consolidated` (2 campos) |
| **Total de custom fields** | 8 | **9** |
| **Lançamentos por semana** | 1 | **2** (início + fim) |
| **UI de entrada** | lista simples | **duas colunas side-by-side** |
| **Dashboard** | só totais | totais + **comparativo previsão vs real** |
| **Cap 40h** | sobre `hours` | sobre `hours_forecast` e `hours_consolidated` separadamente |

> Uma linha por pessoa+projeto+semana — **não são dois registros separados**.
> Os dois valores coexistem no mesmo registro.

---

## Por que um registro único em vez de dois?

**Opção A — dois registros com campo `type`:**
```
{ person: "Alice", project: "X", iso_week: 5, type: "forecast",     hours: 32 }
{ person: "Alice", project: "X", iso_week: 5, type: "consolidated", hours: 28 }
```
Problema: upsert mais complexo, comparativo exige JOIN, ClickUp fica com o dobro de tasks.

**Opção B — um registro com dois campos (escolhida):**
```
{ person: "Alice", project: "X", iso_week: 5, hours_forecast: 32, hours_consolidated: 28 }
```
Vantagem: comparativo direto, metade das tasks no ClickUp, upsert simples.

> Com a opção B, o gestor vê previsão e real **na mesma linha** no ClickUp.

---

## Novo modelo de dados

```js
{
  ID,                    // ts_id: identificador único (base-36)
  Year,                  // number
  ISO_Week,              // number (1–53)
  Person,                // string
  Project,               // string
  Business_Unit,         // string
  Hours_Forecast,        // integer — previsão lançada no início da semana
  Hours_Consolidated,    // integer — real lançado no fim da semana (pode ser null)
  Notes                  // string
}
```

`Hours_Consolidated` começa como `null` até a consolidação de fim de semana.
A UI trata `null` como campo vazio — não é zero.

---

## Como fica no ClickUp

```
📌 2026-W05 | Alice Silva | Branding / Google Brand Film
   ├── person:                Alice Silva
   ├── project:               Google – Brand Film
   ├── business_unit:         Branding
   ├── year:                  2026
   ├── iso_week:              5
   ├── hours_forecast:        32        ← preenchido na segunda
   ├── hours_consolidated:    28        ← preenchido na sexta
   └── notes:                 "cliente adiou uma entrega"
```

O gestor vê o desvio diretamente: previsto 32, realizado 28.
**Sem precisar abrir o app.**

---

## Custom fields — 9 campos

**List `Alocações Entries`:**

| Campo | Tipo ClickUp | Quando é preenchido |
|---|---|---|
| `ts_id` | Text | na criação |
| `person` | Text | na criação |
| `project` | Text | na criação |
| `business_unit` | Text | na criação |
| `year` | Number | na criação |
| `iso_week` | Number | na criação |
| `hours_forecast` | Number | início de semana |
| `hours_consolidated` | Number | fim de semana |
| `notes` | Text | qualquer momento |

**Lists `People`, `Projects`, `Business Units`:** sem campos — só nome.

---

## Workflow da semana

```
SEGUNDA (ou início da semana)
  └── Colaborador abre o app
      └── Preenche "Previsão" por projeto
          Ex: Google Brand Film → 32h
              Overhead          →  8h
      └── Clica "Salvar Previsão"
          └── Cria tasks no ClickUp com hours_forecast preenchido
              hours_consolidated fica null

SEXTA (ou fim da semana)
  └── Colaborador abre o app
      └── Vê a previsão que fez
      └── Revisa e preenche "Consolidado" por projeto
          Ex: Google Brand Film → 28h  (foi menos)
              Overhead          →  8h  (igual)
      └── Clica "Salvar Consolidado"
          └── Atualiza as tasks: preenche hours_consolidated
              hours_forecast permanece intacto
```

---

<!-- _class: divider -->

## Layout do Webapp

_O que muda na interface_

---

## Tela de lançamento — duas colunas

```
Semana 5 · 2026          Alice Silva          [Salvar Previsão] [Salvar Consolidado]

  Projeto                 BU              Previsão    Consolidado
  ─────────────────────────────────────────────────────────────────
  Google – Brand Film     Branding          [32]          [28]
  Overhead                Admin              [8]           [8]
  + Adicionar linha
  ─────────────────────────────────────────────────────────────────
  Total                                      40            36     ← desvio: -4h
```

- Dois botões de salvar independentes — ou um único "Salvar" que grava os dois
- `Consolidado` começa vazio (null), não zero
- Cap de 40h validado em cada coluna separadamente
- Linha com desvio (forecast ≠ consolidated) pode ter cor diferente

---

## Estados visuais de uma linha

| Estado | Previsão | Consolidado | Visual sugerido |
|---|---|---|---|
| Só previsão | ✅ preenchida | — vazia | linha normal |
| Consolidado igual | ✅ preenchida | ✅ igual | linha neutra |
| Consolidado menor | ✅ preenchida | ✅ menor | valor em âmbar |
| Consolidado maior | ✅ preenchida | ✅ maior | valor em vermelho |
| Sem previsão ainda | — vazia | — vazia | linha esmaecida |

> Desvio positivo (realizou mais do que previu) é tão relevante quanto negativo.

---

## Tela de Dashboard — novo comparativo

O Dashboard ganha uma seção nova além dos totais atuais:

```
┌─────────────────────────────────────────────────────────┐
│  Previsão vs Real — Semana 5                            │
│                                                         │
│  Pessoa          Previsto   Real   Desvio               │
│  Alice Silva       40h      36h    -4h  ●               │
│  Bruno Costa       32h      32h     0h  ✓               │
│  Carol Matos       24h      28h    +4h  ▲               │
│                                                         │
│  [ver por projeto]  [ver por BU]  [ver semanas]        │
└─────────────────────────────────────────────────────────┘
```

Análise histórica: projetos que sistematicamente desviam da previsão.

---

## Indicador de status da semana

O header da semana pode mostrar o estado atual:

```
Semana 5 · 2026  ·  Alice Silva

  ○ Sem lançamento      → semana em branco
  ◑ Previsão lançada    → só hours_forecast preenchido
  ● Consolidado lançado → hours_consolidated preenchido
```

Útil para o gestor verificar quem ainda não consolidou.
No Dashboard: lista de pessoas com semana aberta (previsão sem consolidado).

---

<!-- _class: divider -->

## Jornadas de uso

---

## Colaborador — início de semana

```
1. Abre o app (segunda-feira)
   └── App carrega entries da semana atual  →  1 requisição
       └── Se já existe: mostra previsão anterior para editar
       └── Se não existe: tela em branco

2. Preenche a coluna "Previsão" por projeto
   └── Tudo local

3. Clica "Salvar Previsão"
   └── Para cada linha nova:  POST (cria task com hours_forecast)
   └── Para cada linha existente: PUT (atualiza hours_forecast)
   └── hours_consolidated não é tocado

4. Total típico: ~3–6 requisições
```

---

## Colaborador — fim de semana

```
1. Abre o app (sexta-feira)
   └── App carrega entries da semana  →  1 requisição
       └── Mostra previsão na coluna da esquerda (readonly)
       └── Coluna "Consolidado" pré-preenchida com o valor da previsão
           (o colaborador ajusta onde divergiu)

2. Revisa e edita a coluna "Consolidado"

3. Clica "Salvar Consolidado"
   └── Para cada linha: PUT com hours_consolidated
       (só atualiza esse campo — hours_forecast intacto)

4. Total típico: ~3–6 requisições (só PUTs, tasks já existem)
```

> Pré-preencher consolidado com a previsão reduz atrito: colaborador só edita o que mudou.

---

## Gestor — o que ganha

**No ClickUp (sem abrir o app):**
- Cria view com `hours_forecast` e `hours_consolidated` lado a lado
- Filtra por `iso_week` ou `person` para ver o desvio
- Exporta para planilha com os dois valores

**No Dashboard do app:**
- Comparativo previsão vs real por semana, pessoa, projeto, BU
- Histórico de desvios — identifica projetos sistematicamente subplanejados
- Lista de semanas abertas: quem tem previsão mas não consolidou ainda

---

<!-- _class: divider -->

## Arquitetura Técnica

---

## Estrutura do código

**4 arquivos novos** (camada ClickUp — estrutura igual à v2):

```
src/lib/clickup/
├── client.js    → fetch base: auth, retry em 429, delay 50ms
├── fields.js    → auto-descobre 9 UUIDs dos custom fields
├── entries.js   → loadForWeek · loadLastYear · upsertForecast
│                  upsertConsolidated · deleteRow
└── lists.js     → loadAll · addItem · renameItem · deleteItem
```

**3 arquivos modificados:**

```
src/AlocaçõesApp.jsx  → UI de entrada com 2 colunas + 2 operações de salvar
src/Dashboard.jsx     → seção comparativo previsão vs real
src/Directory.jsx     → trocar 4 chamadas Supabase (igual à v2)
```

---

## `entries.js` — as duas operações de salvar

```js
// Salva só a previsão (início de semana)
async function upsertForecast(rows) {
  for (const row of rows) {
    const cachedId = taskIdCache.get(row.ID);
    if (cachedId) {
      await updateTask(cachedId, {
        [fields.hours_forecast]: row.Hours_Forecast
      });
    } else {
      const t = await createTask(row);  // cria com hours_forecast, consolidated null
      taskIdCache.set(row.ID, t.id);
    }
  }
}

// Salva só o consolidado (fim de semana) — tasks já existem
async function upsertConsolidated(rows) {
  for (const row of rows) {
    const cachedId = taskIdCache.get(row.ID);
    await updateTask(cachedId, {
      [fields.hours_consolidated]: row.Hours_Consolidated
    });
  }
}
```

---

## Cap de 40h — duas validações

```js
// Cap aplicado separadamente em cada coluna
function allowedAfterCap(entries, currentRow, field) {
  const others = entries.filter(e =>
    e.Person === currentRow.Person &&
    e.ISO_Week === currentRow.ISO_Week &&
    e.ID !== currentRow.ID
  );
  const used = others.reduce((sum, e) => sum + (e[field] ?? 0), 0);
  return Math.max(0, 40 - used);
}

// Uso:
allowedAfterCap(entries, row, 'Hours_Forecast')
allowedAfterCap(entries, row, 'Hours_Consolidated')
```

Previsão e consolidado têm caps independentes — é possível ter 40h previstas e 42h realizadas.

---

## Auto-descoberta dos field UUIDs

```js
// 9 campos descobertos por nome, cacheados em localStorage
async function discoverFields() {
  const cached = localStorage.getItem('cu:fields:v3');
  if (cached) return JSON.parse(cached);

  const res = await cuFetch(`/list/${LIST_ENTRIES}/field`);
  const map = Object.fromEntries(res.fields.map(f => [f.name, f.id]));
  localStorage.setItem('cu:fields:v3', JSON.stringify(map));
  return map;
}
```

Nomes exatos a criar no ClickUp:
`ts_id · person · project · business_unit · year · iso_week · hours_forecast · hours_consolidated · notes`

---

## Variáveis de ambiente — sem mudança

```bash
VITE_CLICKUP_TOKEN=pk_...           # Token pessoal da conta ClickUp
VITE_CLICKUP_LIST_ENTRIES=...       # ID da List "Alocações Entries"
VITE_CLICKUP_LIST_PEOPLE=...        # ID da List "People"
VITE_CLICKUP_LIST_PROJECTS=...      # ID da List "Projects"
VITE_CLICKUP_LIST_BUS=...           # ID da List "Business Units"
```

Continua 5 variáveis — nenhuma mudança em relação à v2.

---

## Setup no ClickUp

**O que criar manualmente (~12 min):**

1. Space/Folder: _"Alocações"_
2. 4 Lists: `Alocações Entries`, `People`, `Projects`, `Business Units`
3. Na list `Alocações Entries`, 9 campos com nomes exatos:

| Campos texto | Campos número |
|---|---|
| `ts_id`, `person`, `project`, `business_unit`, `notes` | `year`, `iso_week`, `hours_forecast`, `hours_consolidated` |

---

## Plano de implementação

| Fase | O que fazer | Complexidade |
|---|---|---|
| **1. Setup ClickUp** | Criar lists + 9 campos | Baixa |
| **2. `client.js`** | fetch base, auth, retry 429 | Baixa |
| **3. `fields.js`** | auto-descoberta de 9 field IDs | Baixa |
| **4. `entries.js`** | loadForWeek, loadLastYear, upsertForecast, upsertConsolidated | **Alta** |
| **5. `lists.js`** | CRUD de people/projects/BUs | Média |
| **6. `AlocaçõesApp.jsx`** | UI 2 colunas + 2 botões de salvar + cap por coluna | **Alta** |
| **7. `Dashboard.jsx`** | comparativo previsão vs real + status da semana | Média |
| **8. `Directory.jsx`** | trocar 4 chamadas Supabase | Baixa |
| **9. Testes** | fluxo segunda + sexta, desvio, cap | — |

Fases críticas: **`entries.js`** e **`AlocaçõesApp.jsx`** — mais trabalho que a v2.

---

## Limitações — igual às versões anteriores

| Limitação | Impacto | Mitigação |
|---|---|---|
| Token pessoal (sem RLS) | Baixo — uso interno | Só deploy privado/intranet |
| "Carregar Ano" lento (5–8s) | Gestor, uso raro | Barra de progresso |
| Sem deploy público seguro | Estrutural | Rede interna ou Cloudflare Access |

> **Nova consideração:** se o colaborador não consolidar na sexta, `hours_consolidated` fica null para sempre naquela semana. O gestor consegue identificar isso facilmente — é uma semana com previsão mas sem real.

---

<!-- _class: cover -->

## Resumo v3

**Modelo:** 9 campos — `hours_forecast` + `hours_consolidated` no mesmo registro

**Para o colaborador:** 2 lançamentos por semana, UI com 2 colunas, pré-preenchimento facilita a sexta

**Para o gestor:** desvio previsão vs real visível no ClickUp e no Dashboard

**Custo adicional vs v2:** `AlocaçõesApp.jsx` mais complexo, Dashboard ganha seção nova

---

4 listas ClickUp · **9 custom fields** · 4 arquivos novos · **3 modificados**

`hours_forecast` + `hours_consolidated` · 1 registro por pessoa+projeto+semana
