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

# Alocações + ClickUp

Novo app com ClickUp como único banco de dados

Análise · Jornada de uso · Plano técnico

---

## Visão geral

```
┌──────────────────────┐             ┌────────────────────────────────┐
│                      │             │           CLICKUP               │
│   WEBAPP             │   API v2    │                                 │
│   (React + Vite)     │◀──────────▶│  📋 Alocações Entries           │
│                      │   fetch()   │  👤 People                     │
│   UI idêntica        │             │  📁 Projects                   │
│   Lógica idêntica    │             │  🏢 Business Units              │
│                      │             │                                 │
└──────────────────────┘             └────────────────────────────────┘
```

**O que muda:** o banco de dados.
**O que fica:** toda a interface, toda a lógica de negócio, todos os cálculos.

---

## Quem usa e como

**3 perfis de uso, frequências muito diferentes:**

| Perfil | O que faz | Frequência |
|---|---|---|
| **Colaborador** | Lança horas da semana | 1–2x por semana |
| **Gestor** | Vê dashboard, verifica horas no ClickUp | 1–3x por semana |
| **Admin** | Adiciona/remove pessoas, projetos, BUs | Esporádico |

> O colaborador é o **usuário principal**. A experiência dele precisa ser rápida e sem atrito — mesmo sobre a API do ClickUp.

---

<!-- _class: divider -->

## Jornada do Colaborador

_"Vou lançar minhas horas da semana"_

---

## Colaborador — passo a passo

```
1. Abre o app (segunda ou sexta)
   └── App busca people/projects/BUs no ClickUp  →  3 requisições

2. Seleciona o próprio nome e a semana atual
   └── Nenhuma chamada de API ainda

3. Preenche horas por projeto (ex: 3 linhas)
   └── Tudo local, sem API

4. Clica "Adicionar à Base"
   └── Para cada linha:
       - Já existe no cache? → atualiza  (1 PUT + campos alterados)
       - Não existe?         → cria      (1 POST com tudo inline)
   └── ~6 requisições para 3 linhas novas

5. Pronto. Tasks aparecem no ClickUp automaticamente.
```

**Total de requisições na sessão típica: ~9**
Bem dentro do limite de 100 req/min do plano Free.

---

## Colaborador — o que aparece no ClickUp

Cada linha do alocações vira uma task:

```
📌 2026-W05 | Alice Silva | Branding / Google Brand Film
   ├── person:        Alice Silva
   ├── project:       Google – Brand Film
   ├── business_unit: Branding
   ├── year: 2026  |  iso_week: 5
   ├── mon: 8  tue: 8  wed: 8  thu: 8  fri: 8
   ├── total: 40
   └── notes: ""
```

O gestor consegue ver, filtrar e exportar essas tasks diretamente no ClickUp —
**sem precisar abrir o app**.

---

<!-- _class: divider -->

## Jornada do Gestor

_"Quero ver como as horas estão distribuídas"_

---

## Gestor — duas formas de acessar os dados

**Via app (Dashboard):**
1. Abre o app → clica "Carregar Ano"
2. App busca entradas dos últimos 365 dias (paginado, 100/página)
3. Dashboard agrega tudo client-side: por pessoa, projeto, BU, semana
4. Resultado: gráficos e tabelas interativas

**Direto no ClickUp (sem abrir o app):**
- Cria uma View na List "Alocações Entries" filtrada por `person`, `project` ou `iso_week`
- Usa campos calculados ou exporta para planilha
- Não depende do app, não consome requisições da API

> **Essa é a vantagem real do ClickUp:** o gestor tem autonomia sobre os dados sem depender do app ou de quem desenvolveu.

---

## Gestor — tempo de carregamento

"Carregar Ano" é a operação mais pesada:

```
2.000 registros ÷ 100 por página = 20 requisições sequenciais
~250ms por requisição × 20 = ~5–8 segundos
```

**Comparado ao Supabase:** < 1 segundo.

**Como lidar:**
- Exibir barra de progresso com contador de páginas carregadas
- Mensagem "Carregando histórico... (página 3/20)"
- Operação é rara (não é fluxo diário)

> O colaborador nunca usa "Carregar Ano". Só o gestor, ocasionalmente.
> Para o colaborador, tudo é < 1 segundo.

---

<!-- _class: divider -->

## Jornada do Admin

_"Preciso adicionar um novo projeto"_

---

## Admin — gerenciar cadastros

A tela "Cadastros" (Directory) continua igual. Por baixo:

```
Adicionar projeto:
  POST /list/{PROJECTS_LIST_ID}/task  { name: "Novo Projeto" }
  → 1 requisição ✅

Renomear pessoa:
  PUT /task/{task_id}  { name: "Nome Atualizado" }
  → 1 requisição ✅

Deletar BU:
  DELETE /task/{task_id}
  → 1 requisição ✅
```

People, Projects e Business Units são listas simples no ClickUp —
cada item é apenas uma task com o nome como título, **sem custom fields**.

---

<!-- _class: divider -->

## Arquitetura Técnica

---

## Estrutura do código

**4 arquivos novos** (camada de dados ClickUp):

```
src/lib/clickup/
├── client.js    → fetch base: auth, retry em 429, delay 50ms entre calls
├── fields.js    → auto-descobre UUIDs dos custom fields por nome (1x no startup)
├── entries.js   → loadForWeek · loadLastYear · upsertMany · deleteRow · updateRow
└── lists.js     → loadAll · addItem · renameItem · deleteItem
```

**2 arquivos modificados** (cirurgia mínima):
```
src/AlocaçõesApp.jsx  → 6 funções Supabase → 6 chamadas ClickUp
src/Directory.jsx     → 4 funções Supabase → 4 chamadas ClickUp
```

**Tudo que não muda:**
```
Dashboard.jsx · App.jsx · main.jsx · App.css · index.css · vite.config.js
```

---

## Upsert sem suporte nativo — solução

ClickUp não tem `INSERT ON CONFLICT UPDATE`. Solução: **cache de IDs em memória**.

```js
// Cache: ts_id → clickup_task_id (vive durante a sessão)
const taskIdCache = new Map();

// Após qualquer "Carregar Semana" ou "Carregar Ano":
tasks.forEach(t => taskIdCache.set(getTsId(t), t.id));

// Ao salvar:
async function upsertRow(row) {
  const cachedId = taskIdCache.get(row.ID);
  if (cachedId) {
    await updateTask(cachedId, row);        // atualiza — sem GET extra
  } else {
    const t = await createTask(row);        // cria com todos os campos inline
    taskIdCache.set(row.ID, t.id);
  }
}
```

Se o colaborador carregou a semana antes de salvar (fluxo normal), o cache já está populado.
**Zero requisições extras de busca no caso comum.**

---

## Auto-descoberta dos field UUIDs

Em vez de 13 variáveis de ambiente para IDs de campos:

```js
// Roda uma vez, resultado fica em localStorage['cu:fields:v1']
async function discoverFields() {
  const cached = localStorage.getItem('cu:fields:v1');
  if (cached) return JSON.parse(cached);             // hit → 0 requisições

  const res = await cuFetch(`/list/${LIST_ENTRIES}/field`);
  const map = Object.fromEntries(res.fields.map(f => [f.name, f.id]));
  localStorage.setItem('cu:fields:v1', JSON.stringify(map));
  return map;                                         // miss → 1 requisição
}
```

Campos descobertos por nome — portanto, devem ser criados no ClickUp com esses nomes exatos:
`ts_id · person · project · business_unit · year · iso_week · week_start · mon · tue · wed · thu · fri · total · notes`

---

## Variáveis de ambiente (apenas 5)

```bash
VITE_CLICKUP_TOKEN=pk_...           # Token pessoal da conta ClickUp
VITE_CLICKUP_LIST_ENTRIES=...       # ID da List "Alocações Entries"
VITE_CLICKUP_LIST_PEOPLE=...        # ID da List "People"
VITE_CLICKUP_LIST_PROJECTS=...      # ID da List "Projects"
VITE_CLICKUP_LIST_BUS=...           # ID da List "Business Units"
```

Comparado ao Supabase (2 variáveis), são 3 a mais — mas o setup visual no ClickUp é mais simples do que criar tabelas SQL.

---

## Limitações que precisam ser aceitas

| Limitação | Impacto no uso diário | Mitigação |
|---|---|---|
| Token pessoal (sem RLS) | Baixo — uso interno | Só deploy privado/intranet |
| "Carregar Ano" lento (5–8s) | Gestor, uso raro | Barra de progresso |
| Editar linha = N requisições | Baixo — edições são raras | Diff de campos antes de enviar |
| Sem deploy público seguro | Estrutural | Hospedar em rede interna ou Cloudflare Access |

> O colaborador **nunca sente** as limitações. O impacto é no gestor, em operações ocasionais.

---

## Setup no ClickUp (antes de codificar)

**O que criar manualmente (~15 min):**

1. Um **Space** ou **Folder** dedicado (ex: _"Alocações"_)
2. 4 **Lists** dentro dele:
   - `Alocações Entries` — com os 13 custom fields
   - `People` — sem custom fields
   - `Projects` — sem custom fields
   - `Business Units` — sem custom fields
3. Na list `Alocações Entries`, criar os campos com os **nomes exatos**:

| Campos texto | Campos número | Campo data |
|---|---|---|
| `ts_id`, `person`, `project`, `business_unit`, `notes` | `year`, `iso_week`, `mon`, `tue`, `wed`, `thu`, `fri`, `total` | `week_start` |

---

## Plano de implementação

| Fase | O que fazer | Complexidade |
|---|---|---|
| **1. Setup ClickUp** | Criar lists e campos manualmente | Baixa |
| **2. `client.js`** | fetch base, auth, retry 429 | Baixa |
| **3. `fields.js`** | auto-descoberta de field IDs | Baixa |
| **4. `entries.js`** | todas as operações de leitura/escrita | Alta |
| **5. `lists.js`** | CRUD de people/projects/BUs | Média |
| **6. `AlocaçõesApp.jsx`** | trocar 6 chamadas Supabase | Média |
| **7. `Directory.jsx`** | trocar 4 chamadas Supabase | Baixa |
| **8. Testes** | fluxo completo do colaborador e gestor | — |

A fase mais crítica é **`entries.js`**: upsert com cache, paginação do "Carregar Ano", e update com diff de campos.

---

<!-- _class: cover -->

## Resumo

**Para o colaborador:** rápido, transparente, nada muda na UI

**Para o gestor:** dados visíveis no ClickUp sem abrir o app

**Para a equipe:** 5 variáveis de ambiente, sem SQL, sem Supabase

---

4 listas ClickUp · 13 custom fields · 4 arquivos novos · 2 modificados
