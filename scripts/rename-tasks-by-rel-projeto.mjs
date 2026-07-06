/**
 * Renomeia tasks em Registro de Alocações cujo nome está dessincronizado
 * do projeto atual (rel_projeto[0].name).
 *
 * Lógica:
 *   1. Busca todas as tasks da lista com custom_fields.
 *   2. Para cada task, lê rel_projeto[0].name (nome atual do projeto no ClickUp).
 *   3. Parseia o nome atual da task: "YYYY-Www | Pessoa | ProjetoAntigo".
 *   4. Se o projeto no nome difere do rel_projeto, renomeia para o nome correto.
 *
 * Uso:
 *   node scripts/rename-tasks-by-rel-projeto.mjs          # dry-run (padrão)
 *   node scripts/rename-tasks-by-rel-projeto.mjs --apply  # aplica as renomeações
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local' });

const TOKEN    = process.env.VITE_CLICKUP_TOKEN;
const LIST_ID  = process.env.VITE_CLICKUP_LIST_ENTRIES || '901326824645';
const BASE     = 'https://api.clickup.com/api/v2';
const DRY_RUN  = !process.argv.includes('--apply');
const FIELD_REL_PROJ = 'ac9c3838-f316-45ea-ba05-b177b3148715';

if (!TOKEN) {
  console.error('VITE_CLICKUP_TOKEN não encontrado em .env.local');
  process.exit(1);
}

console.log(DRY_RUN ? '🔍 Modo DRY-RUN (use --apply para renomear de verdade)\n' : '✏️  Modo APPLY — renomeações serão gravadas no ClickUp\n');

async function cuFetch(path, opts = {}) {
  const { method = 'GET', body } = opts;
  while (true) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: TOKEN,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') || 1);
      await new Promise(r => setTimeout(r, retry * 1000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
  }
}

function parsePersonProject(name) {
  const m = name.match(/^(\d{4}-W\d{2})\s*\|\s*(.+?)\s*\|\s*(.+)$/);
  if (m) return { prefix: m[1], person: m[2].trim(), project: m[3].trim() };
  return null;
}

async function loadAllTasks() {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(
      `/list/${LIST_ID}/task?page=${page}&limit=100&include_closed=true`
    );
    tasks.push(...(data.tasks || []));
    console.log(`  Carregadas ${tasks.length} tasks...`);
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  return tasks;
}

async function main() {
  console.log('Carregando tasks...');
  const tasks = await loadAllTasks();
  console.log(`Total: ${tasks.length} tasks\n`);

  let toRename = 0, renamed = 0, skipped = 0, noRel = 0;

  for (const task of tasks) {
    const parsed = parsePersonProject(task.name);
    if (!parsed) { skipped++; continue; }

    const relField = (task.custom_fields || []).find(f => f.id === FIELD_REL_PROJ);
    const relValue = relField?.value;
    if (!Array.isArray(relValue) || !relValue[0]?.name) { noRel++; continue; }

    const currentProject = relValue[0].name;
    if (parsed.project === currentProject) continue; // já está correto

    const newName = `${parsed.prefix} | ${parsed.person} | ${currentProject}`;
    toRename++;
    console.log(`  [RENAME] ${task.name}`);
    console.log(`       →   ${newName}`);

    if (!DRY_RUN) {
      await cuFetch(`/task/${task.id}`, { method: 'PUT', body: { name: newName } });
      renamed++;
      await new Promise(r => setTimeout(r, 200)); // throttle gentil
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Tasks analisadas : ${tasks.length}`);
  console.log(`Sem rel_projeto  : ${noRel}`);
  console.log(`Formato inválido : ${skipped}`);
  console.log(`Precisam renomear: ${toRename}`);
  if (!DRY_RUN) console.log(`Renomeadas       : ${renamed}`);
  console.log(DRY_RUN ? '\nRode com --apply para renomear.' : '\nConcluído.');
}

main().catch(err => { console.error(err); process.exit(1); });
