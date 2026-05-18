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
---

<!-- _class: cover -->

# Alocações + ClickUp

Substituição de planilhas por uma interface estruturada

Modelo · Jornadas · Plano técnico

---

## O problema hoje

O controle de horas do Grupo SAL é feito em **planilhas**.

Esse modelo apresenta problemas recorrentes:

- **Erros de input** — campos livres sem validação, digitação errada de nomes, projetos ou horas
- **Inconsistência** — cada pessoa preenche do seu jeito, sem estrutura comum
- **Visibilidade fragmentada** — o gestor precisa consolidar múltiplas planilhas para ter a visão do time
- **Sem histórico confiável** — versões se perdem, sobrescritas, renomeações de arquivo
- **Processo manual** — não há separação clara entre o que foi planejado e o que foi realizado

> A planilha funciona para uma pessoa. Não funciona para um time.

---

## A proposta

Substituir as planilhas por um **webapp dedicado**, usando o ClickUp como banco de dados.

**O que o webapp resolve:**
- Campos com validação — nomes de pessoas e projetos selecionados de uma lista, não digitados livremente
- Estrutura comum para todos — mesma interface, mesmos campos, mesma semana ISO
- Gestor aloca o time de uma vez, na mesma tela
- Colaborador confirma o realizado ao fim da semana
- Histórico persistente e consultável

**Por que ClickUp como banco:**
- Os dados ficam visíveis no workspace que a equipe já usa
- Filtros, agrupamentos e exportações nativos, sem desenvolvimento adicional
- Sem banco SQL dedicado, sem servidor para manter

---

## Arquitetura geral

```
┌──────────────────────┐             ┌────────────────────────────────┐
│                      │             │           CLICKUP               │
│   WEBAPP             │   API v2    │                                 │
│   (React + Vite)     │◀──────────▶│  📋 Alocações Entries           │
│                      │   fetch()   │  👤 People                     │
│   Client-only        │             │  📁 Projects                   │
│   Sem servidor       │             │  🏢 Business Units              │
│                      │             │                                 │
└──────────────────────┘             └────────────────────────────────┘
```

4 listas no ClickUp funcionam como banco de dados.
A lista `Alocações Entries` concentra toda a lógica — as outras três são cadastros de referência.

---

## Modelo de dados

Cada linha do alocações é **um registro único** por pessoa + projeto + semana:

```js
{
  // nome da task no ClickUp — gerado pelo app, serve como chave única:
  // "2026-W05 | Alice Silva | Google – Brand Film"

  year,               // ex: 2026
  iso_week,           // ex: 5  (semana ISO)
  person,             // ex: "Alice Silva"
  project,            // ex: "Google – Brand Film"
  business_unit,      // ex: "Branding"
  hours_forecast,     // horas alocadas pelo gestor no início da semana
  hours_consolidated, // horas reais confirmadas pelo colaborador no fim da semana
  notes               // observações livres
}
```

**O nome da task é o identificador** — derivado deterministicamente de `year + iso_week + person + project`. Não é um campo extra, é o próprio título visível no ClickUp.

**Dois valores de horas por registro, dois responsáveis distintos:**
`hours_forecast` → gestor, na segunda.
`hours_consolidated` → colaborador, na sexta.

---

## Workflow da semana

```
SEGUNDA — Gestor aloca o time
  └── Abre o app, seleciona a semana
  └── Para cada pessoa do time, distribui horas por projeto:
      Alice  →  Google Brand Film: 32h  /  Overhead: 8h
      Bruno  →  Rebranding XYZ: 40h
      Carol  →  Google Brand Film: 16h  /  Pitch Y: 24h
  └── Salva → registros criados no ClickUp com hours_forecast

      ──────────────────────────────────────────
      semana acontece
      ──────────────────────────────────────────

SEXTA — Colaborador consolida o realizado
  └── Abre o app, vê o que o gestor alocou para ele
  └── Confirma ou ajusta as horas por projeto
      Google Brand Film → 28h  (foi menos)
      Overhead          →  8h  (igual)
  └── Salva → registros atualizados com hours_consolidated
```

---

## Perfis de uso

| Perfil | Responsabilidade | Momento | Frequência |
|---|---|---|---|
| **Gestor** | Aloca o time todo — preenche `hours_forecast` para cada pessoa | Segunda-feira | 1× por semana |
| **Colaborador** | Confirma o realizado — preenche `hours_consolidated` | Sexta-feira | 1× por semana |
| **Admin** | Mantém o cadastro de pessoas, projetos e BUs | Conforme necessário | Esporádico |

> A separação de responsabilidades é intencional: o gestor planeja, o colaborador confirma.
> O desvio entre os dois é a informação mais valiosa para a gestão.

---

## Como fica no ClickUp

Cada linha do alocações vira uma **task**:

```
📌 2026-W05 | Alice Silva | Google – Brand Film   ← nome = chave única
   ├── person:                Alice Silva
   ├── project:               Google – Brand Film
   ├── business_unit:         Branding
   ├── year:                  2026
   ├── iso_week:              5
   ├── hours_forecast:        32       ← alocado pelo gestor
   ├── hours_consolidated:    28       ← confirmado pela Alice
   └── notes:                 "cliente adiou uma entrega"
```

O nome da task é legível e único — serve ao mesmo tempo como título no ClickUp
e como chave para o upsert no app. Sem campo de ID auxiliar.

O desvio (32 → 28) fica **visível para qualquer membro do workspace**,
sem precisar abrir o app ou consolidar planilhas.

---

<!-- _class: divider -->

## Layout do Webapp

---

## Tela do gestor — alocação do time

O gestor vê o time inteiro em uma única tela, organizada por semana:

```
╔══════════════════════════════════════════════════════════════════════╗
║  Semana 5 · 27 jan – 31 jan 2026                    [Salvar Tudo]   ║
╠══════════════════════════════════════════════════════════════════════╣
║  Pessoa          Projeto                  BU          Previsão      ║
║  ────────────────────────────────────────────────────────────────   ║
║  Alice Silva     Google – Brand Film      Branding      [32]        ║
║  Alice Silva     Overhead                 Admin           [8]        ║
║  Bruno Costa     Rebranding XYZ           Design         [40]        ║
║  Carol Matos     Google – Brand Film      Branding       [16]        ║
║  Carol Matos     Pitch Y                  Estratégia     [24]        ║
║  + Adicionar linha                                                   ║
╚══════════════════════════════════════════════════════════════════════╝
```

- Todas as pessoas e projetos selecionados de listas — sem digitação livre
- Cap de 40h validado por pessoa

---

## Tela do colaborador — consolidação

O colaborador vê só as linhas dele, com a previsão do gestor já preenchida:

```
╔══════════════════════════════════════════════════════════════════╗
║  Semana 5 · 27 jan – 31 jan 2026   Alice Silva     [Salvar]     ║
╠══════════════════════════════════════════════════════════════════╣
║  Projeto                  BU           Previsto   Realizado      ║
║  ─────────────────────────────────────────────────────────────   ║
║  Google – Brand Film      Branding        32        [28]         ║
║  Overhead                 Admin            8         [8]         ║
║  ─────────────────────────────────────────────────────────────   ║
║  Total                                    40         36          ║
╚══════════════════════════════════════════════════════════════════╝
```

- Coluna "Previsto" é somente leitura — o gestor alocou, o colaborador não altera
- "Realizado" começa pré-preenchido com o previsto — colaborador edita só o que mudou

---

## Estados visuais de uma linha

| Estado | Previsto | Realizado | Visual |
|---|---|---|---|
| Alocado, pendente de consolidação | preenchido | — vazio | linha normal |
| Consolidado sem desvio | preenchido | igual | linha neutra |
| Realizou menos que o previsto | preenchido | menor | valor em âmbar |
| Realizou mais que o previsto | preenchido | maior | valor em vermelho |
| Linha nova (gestor adicionando) | — | — | linha em edição |

---

## Status da semana

O app indica o estado de cada semana:

```
  ○  Não alocada         gestor ainda não fez o planejamento
  ◑  Alocada             gestor preencheu, colaboradores pendentes
  ◕  Parcialmente consolidada   alguns consolidaram, outros não
  ●  Consolidada         todos consolidaram
```

O Dashboard do gestor mostra quais colaboradores ainda têm semana aberta
(previsão lançada pelo gestor, mas consolidado pendente do colaborador).

---

## Dashboard — visão do gestor

```
┌──────────────────────────────────────────────────────────┐
│  Previsão vs Real — Semana 5 · 27 jan – 31 jan 2026      │
│                                                          │
│  Pessoa           Alocado   Real    Desvio               │
│  Alice Silva        40h     36h     -4h  ●               │
│  Bruno Costa        40h     40h      0h  ✓               │
│  Carol Matos        40h     44h     +4h  ▲               │
│                                                          │
│  Pendentes: nenhum  ✓                                    │
│                                                          │
│  [por projeto]   [por BU]   [histórico de semanas]      │
└──────────────────────────────────────────────────────────┘
```

Análise histórica: pessoas e projetos que sistematicamente desviam da alocação.

---

<!-- _class: divider -->

## Jornadas de uso

---

## Gestor — segunda-feira

```
1. Abre o app, seleciona a semana
   └── App carrega people, projects, BUs e entries da semana  → 4 req
       └── Se semana já foi alocada: mostra rascunho para editar
       └── Se não foi: tela em branco com lista do time

2. Distribui horas por pessoa × projeto
   └── Seleciona pessoa em dropdown
   └── Seleciona projeto em dropdown  → BU preenchida automaticamente
   └── Digita horas previstas
   └── Repete para cada alocação

3. Clica "Salvar Tudo"
   └── POST para cada linha nova (cria task com hours_forecast)
   └── PUT para cada linha existente (atualiza hours_forecast)

4. Total típico: ~15–25 requisições para um time de 10 pessoas
```

---

## Colaborador — sexta-feira

```
1. Abre o app
   └── App carrega entries da semana para a pessoa logada  → 1 req
   └── Vê a alocação que o gestor fez na segunda
   └── Coluna "Realizado" pré-preenchida com o alocado

2. Revisa linha a linha
   └── Mantém o valor se bateu com o previsto
   └── Corrige se foi diferente
   └── Pode adicionar nota explicando desvio relevante

3. Clica "Salvar"
   └── PUT em cada linha: preenche hours_consolidated
       hours_forecast permanece intacto

4. Total típico: ~3–6 requisições (só PUTs, tasks já existem)
```

---

## Admin — gerenciar cadastros

A tela de cadastros é simples e raramente usada:

```
Adicionar projeto:
  POST /list/{PROJECTS_LIST_ID}/task  { name: "Novo Projeto" }

Renomear pessoa:
  PUT /task/{task_id}  { name: "Nome Atualizado" }

Deletar BU:
  DELETE /task/{task_id}
```

Pessoas, projetos e BUs são listas no ClickUp — cada item é uma task com apenas o nome.
Qualquer mudança no cadastro reflete imediatamente nos dropdowns do app.

---

<!-- _class: divider -->

## Arquitetura Técnica

---

## Estrutura do código

**4 arquivos novos** — camada de dados ClickUp:

```
src/lib/clickup/
├── client.js    → fetch base: autenticação, retry em 429, delay entre calls
├── fields.js    → descobre os UUIDs dos 9 custom fields por nome (1× no startup)
├── entries.js   → loadForWeek · loadLastYear · upsertForecast
│                  upsertConsolidated · deleteRow
└── lists.js     → loadAll · addItem · renameItem · deleteItem
```

**3 arquivos novos** — interface:

```
src/AlocaçõesApp.jsx  → roteamento entre visão gestor e visão colaborador
src/ManagerView.jsx   → tela de alocação do time (gestor)
src/CollabView.jsx    → tela de consolidação individual (colaborador)
src/Dashboard.jsx     → comparativo previsão vs real
src/Directory.jsx     → CRUD de cadastros
```

---

## Upsert sem suporte nativo

O ClickUp não tem `INSERT OR UPDATE`. Solução: cache de IDs em memória.

```js
// Chave = nome da task, gerado deterministicamente pelo app
function taskName(row) {
  const w = String(row.ISO_Week).padStart(2, '0');
  return `${row.Year}-W${w} | ${row.Person} | ${row.Project}`;
}

// Cache populado após qualquer leitura: taskName → clickup_task_id
const taskIdCache = new Map();

async function upsertForecast(rows) {
  for (const row of rows) {
    const id = taskIdCache.get(taskName(row));
    if (id) {
      await updateTask(id, { hours_forecast: row.Hours_Forecast });
    } else {
      const t = await createTask(taskName(row), row); // nome + campos
      taskIdCache.set(taskName(row), t.id);
    }
  }
}
```

Se o gestor carregou a semana antes de salvar (fluxo normal), o cache já está populado —
**zero requisições extras de busca**.

---

## Auto-descoberta dos field UUIDs

Em vez de 8 variáveis de ambiente para IDs de campos:

```js
// Roda uma vez por dispositivo, resultado fica em localStorage
async function discoverFields() {
  const cached = localStorage.getItem('cu:fields:v1');
  if (cached) return JSON.parse(cached);        // 0 requisições

  const res = await cuFetch(`/list/${LIST_ENTRIES}/field`);
  const map = Object.fromEntries(res.fields.map(f => [f.name, f.id]));
  localStorage.setItem('cu:fields:v1', JSON.stringify(map));
  return map;                                   // 1 requisição
}
```

Os campos são encontrados pelo **nome** — devem ser criados no ClickUp com os nomes exatos.

---

## Setup no ClickUp

**O que criar manualmente (~12 min):**

1. Um **Space** ou **Folder** dedicado — ex: _"Alocações"_
2. 4 **Lists:**
   - `Alocações Entries` — com os 8 custom fields
   - `People` — sem custom fields
   - `Projects` — sem custom fields
   - `Business Units` — sem custom fields
3. Na list `Alocações Entries`, os campos com os **nomes exatos:**

| Campos texto | Campos número |
|---|---|
| `person`, `project`, `business_unit`, `notes` | `year`, `iso_week`, `hours_forecast`, `hours_consolidated` |

---

## Variáveis de ambiente

```bash
# .env.local — nunca subir para o repositório

VITE_CLICKUP_TOKEN=pk_...        # Token pessoal da conta ClickUp
VITE_CLICKUP_LIST_ENTRIES=...    # ID da List "Alocações Entries"
VITE_CLICKUP_LIST_PEOPLE=...     # ID da List "People"
VITE_CLICKUP_LIST_PROJECTS=...   # ID da List "Projects"
VITE_CLICKUP_LIST_BUS=...        # ID da List "Business Units"
```

5 variáveis no total. Os IDs das listas ficam na URL ao abrir cada list no ClickUp.

> O token pessoal significa que o app deve ser hospedado em rede interna
> ou com acesso restrito (ex: Cloudflare Access). Nunca deploy público.

---

## Plano de implementação

| Fase | O que fazer | Complexidade |
|---|---|---|
| **1. Setup ClickUp** | Criar as 4 lists e os 9 campos | Baixa |
| **2. `.env.local`** | Token + 4 IDs de listas | Baixa |
| **3. `client.js`** | fetch base, auth, retry em 429 | Baixa |
| **4. `fields.js`** | auto-descoberta e cache de field UUIDs | Baixa |
| **5. `entries.js`** | leitura, upsertForecast, upsertConsolidated | **Alta** |
| **6. `lists.js`** | CRUD de people, projects, BUs | Média |
| **7. `ManagerView.jsx`** | tela de alocação do time (gestor) | **Alta** |
| **8. `CollabView.jsx`** | tela de consolidação individual | Média |
| **9. `Dashboard.jsx`** | comparativo alocado vs real | Média |
| **10. `Directory.jsx`** | CRUD de cadastros | Baixa |
| **11. Testes** | fluxo gestor segunda + colaborador sexta | — |

---

## Limitações

| Limitação | Impacto no uso | Mitigação |
|---|---|---|
| Token pessoal — sem login individual | Baixo — uso interno | Deploy em rede interna ou Cloudflare Access |
| "Carregar Ano" lento (~5–8s) | Gestor, uso ocasional | Barra de progresso com contador de páginas |
| Plano Free: 100 req/min | Pode ser sentido ao salvar time grande | Delay de 50ms entre chamadas |
| Colaborador sem consolidar na sexta | Semana fica incompleta | Indicador no Dashboard + lista de pendentes |

---

<!-- _class: cover -->

## Resumo

**Problema:** planilhas são frágeis, inconsistentes e sem separação de responsabilidades

**Solução:** webapp com ClickUp como banco — validação de input, fluxo estruturado, histórico confiável

**Para o gestor:** aloca o time todo de uma vez, acompanha desvios no ClickUp e no Dashboard

**Para o colaborador:** interface simples, vê o que foi alocado, confirma o realizado

---

4 listas ClickUp · 8 custom fields · nome da task como chave · sem servidor · sem banco SQL