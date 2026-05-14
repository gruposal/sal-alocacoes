/**
 * Retry pros 27 erros do import: para cada task no log com status=error,
 * acha o taskId atual pela query de nome e tenta setar rel_colaborador + rel_projeto.
 *
 * Usa o último import-log-*.json em data/.
 *
 * Uso:
 *   node scripts/retry-failed-rels.mjs            # dry-run
 *   node scripts/retry-failed-rels.mjs --confirm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim();
  });
}
const TOKEN = env.VITE_CLICKUP_TOKEN;
const LIST_ENTRIES  = env.VITE_CLICKUP_LIST_ENTRIES  || '901326824645';
const LIST_PEOPLE   = env.VITE_CLICKUP_LIST_PEOPLE   || '901326824643';
const LIST_PROJECTS = env.VITE_CLICKUP_LIST_PROJECTS || '901326824646';

const FIELDS = {
  rel_colaborador: 'dcd6eb4f-4e04-405d-93dd-8cedb3765938',
  rel_projeto:     'ac9c3838-f316-45ea-ba05-b177b3148715',
};

const CONFIRM = process.argv.includes('--confirm');
const BASE = 'https://api.clickup.com/api/v2';

async function cuFetch(p, opts = {}) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { Authorization: TOKEN, 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After') || 2);
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

function normalizeName(s) {
  return (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function findIdByName(cache, name) {
  if (cache.has(name)) return cache.get(name);
  const n = normalizeName(name);
  for (const [k, v] of cache) if (normalizeName(k) === n) return v;
  return null;
}

async function main() {
  console.log(`MODO: ${CONFIRM ? 'CONFIRM' : 'DRY-RUN'}\n`);

  // Acha último log
  const dataDir = path.join(__dirname, '..', 'data');
  const logs = fs.readdirSync(dataDir).filter(f => /^import-log-\d+\.json$/.test(f)).sort();
  if (logs.length === 0) { console.error('Nenhum import-log-*.json em data/'); process.exit(1); }
  const logFile = path.join(dataDir, logs[logs.length - 1]);
  console.log(`Log: ${logFile}`);

  const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  const errors = log.filter(e => e.status === 'error');
  console.log(`Erros a retentar: ${errors.length}\n`);

  console.log('Carregando entries, pessoas, projetos...');
  const [entries, people, projects] = await Promise.all([
    fetchAllFromList(LIST_ENTRIES),
    fetchAllFromList(LIST_PEOPLE),
    fetchAllFromList(LIST_PROJECTS),
  ]);
  const entryByName = new Map(entries.map(t => [t.name, t.id]));
  const personByName  = new Map(people.map(t => [t.name.trim(), t.id]));
  const projectByName = new Map(projects.map(t => [t.name.trim(), t.id]));
  console.log(`  ${entryByName.size} entries | ${personByName.size} pessoas | ${projectByName.size} projetos\n`);

  let fixed = 0, missing = 0, stillFail = 0;
  for (const e of errors) {
    const taskId = entryByName.get(e.name);
    if (!taskId) {
      console.log(`  [MISSING TASK] ${e.name}`);
      missing++;
      continue;
    }
    // parse "YYYY-Wxx | Person | Project"
    const parts = e.name.split(' | ');
    if (parts.length < 3) { console.log(`  [BAD NAME] ${e.name}`); stillFail++; continue; }
    const [, person, ...projectParts] = parts;
    const project = projectParts.join(' | ');  // "Stone | One Stone | Manifesto Cultura" tem | no nome
    const personId  = findIdByName(personByName, person);
    const projectId = findIdByName(projectByName, project);

    if (!personId || !projectId) {
      console.log(`  [PEOPLE/PROJ MISSING] ${e.name} (personId=${!!personId} projectId=${!!projectId})`);
      stillFail++;
      continue;
    }

    if (!CONFIRM) {
      console.log(`  [would-fix] ${e.name} → person=${personId} project=${projectId}`);
      fixed++;
      continue;
    }

    try {
      await cuFetch(`/task/${taskId}/field/${FIELDS.rel_colaborador}`, {
        method: 'POST', body: { value: { add: [personId] } },
      });
      await new Promise(r => setTimeout(r, 150));
      await cuFetch(`/task/${taskId}/field/${FIELDS.rel_projeto}`, {
        method: 'POST', body: { value: { add: [projectId] } },
      });
      fixed++;
      console.log(`  ✓ ${e.name}`);
    } catch (err) {
      stillFail++;
      console.log(`  ✗ ${e.name}: ${err.message.slice(0, 100)}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Fixáveis/Fixadas: ${fixed}`);
  console.log(`Sem task no ClickUp: ${missing}`);
  console.log(`Ainda falham: ${stillFail}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
