/**
 * Importa o histórico de alocação 2026 da planilha consolidada para o ClickUp.
 *
 * Lê data/historico-2026-snapshot.csv (header:
 *   DATA_ START,DATA_ END,SEMANA,MÊS,PROJETO,UNIDADE_DE_NEGOCIO,PESSOA,
 *   CARGO,TIPO,Nº_HORAS_PREVISTO,Nº_HORAS_REALIZADO)
 *
 * Para cada linha:
 *   - Garante que a pessoa existe em LISTA_PESSOAS (cria se faltar)
 *   - Garante que o projeto existe em LISTA_PROJETOS (cria se faltar)
 *   - Cria task em LISTA_REGISTRO_ALOCACAO no formato "YYYY-Wxx | Pessoa | Projeto"
 *     com horas_previstas, horas_realizadas e centro_de_custo
 *   - Liga os relationship fields rel_colaborador e rel_projeto
 *   - Dedupe: se taskName já existe (de uma rodada anterior), pula
 *
 * Modos:
 *   --dry-run               apenas conta + lista pessoas/projetos a criar (default)
 *   --confirm-creates       libera auto-criar pessoas/projetos novos
 *   --confirm-import        executa o import de entries (requer --confirm-creates)
 *
 * Uso típico:
 *   1) node scripts/import-historico-2026.mjs                       # dry-run
 *   2) node scripts/import-historico-2026.mjs --confirm-creates     # cria pessoas/projetos faltantes
 *   3) node scripts/import-historico-2026.mjs --confirm-creates --confirm-import   # import completo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const CSV_PATH = path.join(__dirname, '..', 'data', 'historico-2026-snapshot.csv');
const LOG_DIR = path.join(__dirname, '..', 'data');

const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
}

const TOKEN          = env.VITE_CLICKUP_TOKEN || process.env.VITE_CLICKUP_TOKEN;
const LIST_ENTRIES   = env.VITE_CLICKUP_LIST_ENTRIES   || '901326824645';
const LIST_PEOPLE    = env.VITE_CLICKUP_LIST_PEOPLE    || '901326824643';
const LIST_PROJECTS  = env.VITE_CLICKUP_LIST_PROJECTS  || '901326824646';

if (!TOKEN) {
  console.error('VITE_CLICKUP_TOKEN não encontrado em .env.local');
  process.exit(1);
}

const CONFIRM_CREATES = process.argv.includes('--confirm-creates');
const CONFIRM_IMPORT  = process.argv.includes('--confirm-import');

// ---------- ClickUp field IDs (mesmos de src/lib/clickup/fields.js) ----------
const FIELDS = {
  ano:               '6cfe5832-2f23-48a6-85b8-3d4b2772aa3d',
  semana_num:        'f277efd9-5809-4b96-aa83-64db7d351891',
  pessoa:            'c4295bb0-84c0-4223-9dff-8aba51259135',
  projeto:           'adc1114d-84b8-4214-a98c-9accc60a3048',
  centro_de_custo:   '02320ff2-3cca-4ad0-b5e0-c7dd3d10e925',
  horas_previstas:   'a120ac5b-de46-4960-a7f4-ef07e66c54de',
  horas_realizadas:  'c704f2c7-aefd-4b70-af83-a42e5996697e',
  rel_colaborador:   'dcd6eb4f-4e04-405d-93dd-8cedb3765938',
  rel_projeto:       'ac9c3838-f316-45ea-ba05-b177b3148715',
};

const CENTRO_DE_CUSTO_OPTIONS = [
  { id: '7aa1503b-224d-4923-ad01-f73d9fd24c6f', name: 'Branding' },
  { id: '4826465d-5845-4d76-9605-50a68672eef5', name: 'Comunicação' },
  { id: '6f8d935c-2070-4b7a-b1b3-c1abdc10de53', name: 'Conteúdo' },
  { id: 'c8d24b20-5be2-478f-beb1-450c8ae21553', name: 'CSC' },
  { id: '9e29f0ed-251a-449e-a17f-b27f55a30836', name: 'Marketing' },
  { id: 'b0a9fe91-5962-4201-8547-5378dea186b1', name: 'Sal' },
  { id: 'ac785520-078e-4e7b-9734-bfa92df3a2e5', name: 'Vendas' },
  { id: '2c4888e8-f2d1-45b8-9f7d-2304dd95608c', name: 'Novos Negócios' },
  { id: '5aab5a54-2177-4019-84fd-91c04cd2f009', name: 'Entretenimento' },
];
const ccNameToId = name => CENTRO_DE_CUSTO_OPTIONS.find(o => o.name === name)?.id ?? null;

// ---------- ClickUp client ----------
const BASE = 'https://api.clickup.com/api/v2';
async function cuFetch(p, opts = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After') || 2);
    console.log(`  [rate-limit] aguardando ${retry}s...`);
    await new Promise(r => setTimeout(r, retry * 1000));
    return cuFetch(p, opts);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAllFromList(listId) {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${listId}/task?page=${page}&limit=100&include_closed=true`);
    const batch = data.tasks || [];
    tasks.push(...batch);
    if (data.last_page || batch.length === 0) break;
    page++;
  }
  return tasks;
}

// ---------- CSV parser ----------
function parseCSV(text) {
  // CSV simples — sem quotes complexas dentro de campos. Suficiente pra essa planilha.
  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

// ---------- Helpers ----------
function makeTaskName(year, isoWeek, person, project) {
  return `${year}-W${String(isoWeek).padStart(2, '0')} | ${person} | ${project}`;
}

function parseHours(s) {
  if (s === '' || s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Normalizar nome para comparação (remove acentos, lowercase). Mesma lógica de entries.js.
function normalizeName(s) {
  return (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function findIdByName(cache, name) {
  if (cache.has(name)) return cache.get(name);
  const norm = normalizeName(name);
  for (const [k, v] of cache) {
    if (normalizeName(k) === norm) return v;
  }
  return null;
}

// ---------- Main ----------
async function main() {
  console.log('=== Import histórico 2026 — Planilha → ClickUp ===\n');

  // 1) Ler CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV não encontrado em ${CSV_PATH}`);
    process.exit(1);
  }
  const csv = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`CSV: ${csv.length} linhas`);

  const rows = csv.map(r => ({
    Year: 2026,
    ISO_Week: Number(r['SEMANA']),
    Person: r['PESSOA'],
    Project: r['PROJETO'],
    Business_Unit: r['UNIDADE_DE_NEGOCIO'],
    Hours_Forecast: parseHours(r['Nº_HORAS_PREVISTO']),
    Hours_Consolidated: parseHours(r['Nº_HORAS_REALIZADO']),
  })).filter(r => r.Person && r.Project && r.ISO_Week);

  console.log(`Linhas válidas: ${rows.length}\n`);

  // 2) Carregar Listas atuais (pessoas + projetos)
  console.log('Carregando LISTA_PESSOAS e LISTA_PROJETOS...');
  const [peopleTasks, projectTasks] = await Promise.all([
    fetchAllFromList(LIST_PEOPLE),
    fetchAllFromList(LIST_PROJECTS),
  ]);
  const personIdCache  = new Map(peopleTasks.map(t => [t.name.trim(), t.id]));
  const projectIdCache = new Map(projectTasks.map(t => [t.name.trim(), t.id]));
  console.log(`  pessoas cadastradas: ${personIdCache.size}`);
  console.log(`  projetos cadastrados: ${projectIdCache.size}\n`);

  // 3) Detectar faltantes
  const csvPeople   = [...new Set(rows.map(r => r.Person.trim()))].sort();
  const csvProjects = [...new Set(rows.map(r => r.Project.trim()))].sort();
  // Match com normalização (sem acentos) — "Edilson Junior" encontra "Edilson Júnior"
  const missingPeople   = csvPeople.filter(p => !findIdByName(personIdCache, p));
  const missingProjects = csvProjects.filter(p => !findIdByName(projectIdCache, p));

  console.log(`Pessoas distintas no CSV: ${csvPeople.length} | faltantes em LISTA_PESSOAS: ${missingPeople.length}`);
  if (missingPeople.length) missingPeople.forEach(p => console.log(`  + ${p}`));
  console.log(`\nProjetos distintos no CSV: ${csvProjects.length} | faltantes em LISTA_PROJETOS: ${missingProjects.length}`);
  if (missingProjects.length) missingProjects.forEach(p => console.log(`  + ${p}`));
  console.log('');

  if ((missingPeople.length || missingProjects.length) && !CONFIRM_CREATES) {
    console.log('Para auto-criar os faltantes:');
    console.log('  node scripts/import-historico-2026.mjs --confirm-creates\n');
    console.log('Para criar E importar tudo:');
    console.log('  node scripts/import-historico-2026.mjs --confirm-creates --confirm-import');
    return;
  }

  // 4) Criar pessoas/projetos faltantes
  if (CONFIRM_CREATES) {
    for (const name of missingPeople) {
      const t = await cuFetch(`/list/${LIST_PEOPLE}/task`, { method: 'POST', body: { name } });
      personIdCache.set(name, t.id);
      console.log(`  pessoa criada: ${name} → ${t.id}`);
      await new Promise(r => setTimeout(r, 200));
    }
    for (const name of missingProjects) {
      const t = await cuFetch(`/list/${LIST_PROJECTS}/task`, { method: 'POST', body: { name } });
      projectIdCache.set(name, t.id);
      console.log(`  projeto criado: ${name} → ${t.id}`);
      await new Promise(r => setTimeout(r, 200));
    }
    if (missingPeople.length || missingProjects.length) console.log('');
  }

  if (!CONFIRM_IMPORT) {
    console.log('Pessoas/projetos faltantes resolvidos. Para executar o import das entries:');
    console.log('  node scripts/import-historico-2026.mjs --confirm-creates --confirm-import');
    return;
  }

  // 5) Carregar entries existentes (dedupe por taskName)
  console.log('Carregando entries existentes em LISTA_REGISTRO_ALOCACAO (para dedupe)...');
  const existingEntries = await fetchAllFromList(LIST_ENTRIES);
  const existingNames = new Set(existingEntries.map(t => t.name));
  console.log(`  ${existingNames.size} entries existentes\n`);

  // 6) Criar entries
  const log = [];
  let created = 0, skipped = 0, errors = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = makeTaskName(row.Year, row.ISO_Week, row.Person, row.Project);
    if (existingNames.has(name)) {
      skipped++;
      log.push({ row: i + 1, name, status: 'skipped' });
      continue;
    }

    try {
      const personId  = findIdByName(personIdCache, row.Person.trim());
      const projectId = findIdByName(projectIdCache, row.Project.trim());
      if (!personId)  throw new Error(`personId missing for "${row.Person}"`);
      if (!projectId) throw new Error(`projectId missing for "${row.Project}"`);

      const ccId = row.Business_Unit ? ccNameToId(row.Business_Unit) : null;

      const task = await cuFetch(`/list/${LIST_ENTRIES}/task`, {
        method: 'POST',
        body: {
          name,
          custom_fields: [
            { id: FIELDS.ano,              value: row.Year },
            { id: FIELDS.semana_num,       value: row.ISO_Week },
            { id: FIELDS.pessoa,           value: row.Person },
            { id: FIELDS.projeto,          value: row.Project },
            ...(ccId ? [{ id: FIELDS.centro_de_custo, value: ccId }] : []),
            { id: FIELDS.horas_previstas,  value: row.Hours_Forecast },
            { id: FIELDS.horas_realizadas, value: row.Hours_Consolidated },
          ],
        },
      });
      await new Promise(r => setTimeout(r, 150));

      await cuFetch(`/task/${task.id}/field/${FIELDS.rel_colaborador}`, {
        method: 'POST', body: { value: { add: [personId] } },
      });
      await new Promise(r => setTimeout(r, 150));

      await cuFetch(`/task/${task.id}/field/${FIELDS.rel_projeto}`, {
        method: 'POST', body: { value: { add: [projectId] } },
      });

      created++;
      existingNames.add(name);
      log.push({ row: i + 1, name, status: 'created', taskId: task.id });
      if (created % 25 === 0) console.log(`  [${i + 1}/${rows.length}] criadas: ${created} | puladas: ${skipped} | erros: ${errors}`);
    } catch (e) {
      errors++;
      log.push({ row: i + 1, name, status: 'error', error: e.message });
      console.error(`  ERRO linha ${i + 1} "${name}": ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // 7) Log final
  const logFile = path.join(LOG_DIR, `import-log-${Date.now()}.json`);
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  console.log('\n=== Resumo ===');
  console.log(`Criadas: ${created}`);
  console.log(`Puladas (já existiam): ${skipped}`);
  console.log(`Erros: ${errors}`);
  console.log(`Log: ${logFile}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
