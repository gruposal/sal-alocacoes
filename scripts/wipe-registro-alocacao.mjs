/**
 * Apaga tasks legadas em LISTA_REGISTRO_ALOCACAO que NÃO seguem o formato
 * "YYYY-Wxx | Pessoa | Projeto" (i.e. tasks importadas no formato antigo
 * "Pessoa → Projeto (Sem N)" antes da migração para o app).
 *
 * Default: --dry-run (lista o que seria apagado, não toca em nada).
 * Para executar: --confirm
 *
 * Uso:
 *   node scripts/wipe-registro-alocacao.mjs            # dry-run
 *   node scripts/wipe-registro-alocacao.mjs --confirm  # apaga de verdade
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

const TOKEN = env.VITE_CLICKUP_TOKEN || process.env.VITE_CLICKUP_TOKEN;
const LIST_ENTRIES = env.VITE_CLICKUP_LIST_ENTRIES || '901326824645';

if (!TOKEN) {
  console.error('VITE_CLICKUP_TOKEN não encontrado em .env.local ou env');
  process.exit(1);
}

const DRY_RUN = !process.argv.includes('--confirm');
const NEW_FORMAT = /^\d{4}-W\d{2} \| .+ \| .+$/;
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

async function fetchAll() {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${LIST_ENTRIES}/task?page=${page}&limit=100&include_closed=true`);
    const batch = data.tasks || [];
    tasks.push(...batch);
    if (data.last_page || batch.length === 0) break;
    page++;
  }
  return tasks;
}

async function main() {
  console.log(`MODO: ${DRY_RUN ? 'DRY-RUN (nada será apagado)' : 'CONFIRM (vai apagar de verdade)'}`);
  console.log(`Lista: ${LIST_ENTRIES}\n`);

  console.log('Carregando todas as tasks...');
  const all = await fetchAll();
  console.log(`Total: ${all.length} tasks na lista\n`);

  const legacy = all.filter(t => !NEW_FORMAT.test(t.name));
  const kept = all.length - legacy.length;
  console.log(`Formato novo (mantém): ${kept}`);
  console.log(`Formato antigo (apaga): ${legacy.length}\n`);

  if (legacy.length === 0) {
    console.log('Nada a fazer.');
    return;
  }

  // Amostra
  console.log('Amostra das primeiras 5 a apagar:');
  legacy.slice(0, 5).forEach(t => console.log(`  - ${t.name}`));
  console.log('');

  if (DRY_RUN) {
    console.log('Para apagar de verdade: node scripts/wipe-registro-alocacao.mjs --confirm');
    return;
  }

  console.log('Apagando...');
  let done = 0;
  let errors = 0;
  for (const t of legacy) {
    try {
      await cuFetch(`/task/${t.id}`, { method: 'DELETE' });
      done++;
      if (done % 10 === 0) console.log(`  [${done}/${legacy.length}]`);
    } catch (e) {
      errors++;
      console.error(`  ERRO em ${t.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`\nApagadas: ${done} | Erros: ${errors}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
