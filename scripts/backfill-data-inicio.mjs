/**
 * Backfill do campo "Data de Início" nos registros existentes.
 * Seta a segunda-feira da semana ISO de cada alocação.
 *
 * Uso: node scripts/backfill-data-inicio.mjs [--dry-run]
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local' });

const TOKEN       = process.env.VITE_CLICKUP_TOKEN;
const LIST_ID     = '901326824645';
const FIELD_ANO   = '6cfe5832-2f23-48a6-85b8-3d4b2772aa3d';
const FIELD_SEMANA= 'f277efd9-5809-4b96-aa83-64db7d351891';
const FIELD_DATA  = 'd2f4fdaa-d78c-4b4c-bb4d-c72e1655e0ac';
const BASE        = 'https://api.clickup.com/api/v2';
const DRY_RUN     = process.argv.includes('--dry-run');

if (!TOKEN) {
  console.error('VITE_CLICKUP_TOKEN não encontrado em .env.local');
  process.exit(1);
}

function isoWeekMonday(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  monday.setHours(12, 0, 0, 0);
  return monday.getTime();
}

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
      const wait = Number(res.headers.get('Retry-After') || 2) * 1000;
      console.log(`  rate limit — aguardando ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ClickUp ${res.status}: ${text}`);
    }
    return res.json();
  }
}

async function loadAllTasks() {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${LIST_ID}/task?page=${page}&limit=100&include_closed=true`);
    tasks.push(...(data.tasks || []));
    process.stdout.write(`\r  carregando... ${tasks.length} registros`);
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  console.log();
  return tasks;
}

function getFieldValue(task, fieldId) {
  const f = (task.custom_fields || []).find(x => x.id === fieldId);
  return f?.value ?? null;
}

async function main() {
  console.log(DRY_RUN ? '🔍 Modo dry-run — nenhuma alteração será feita\n' : '');
  console.log('Carregando registros...');
  const tasks = await loadAllTasks();
  console.log(`Total: ${tasks.length} registros\n`);

  let ok = 0, skip = 0, err = 0;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const ano    = getFieldValue(t, FIELD_ANO);
    const semana = getFieldValue(t, FIELD_SEMANA);

    if (!ano || !semana) {
      process.stdout.write(`\r[${i + 1}/${tasks.length}] ${t.name.slice(0, 50)} — sem Ano/Semana, pulando`);
      skip++;
      continue;
    }

    const ts = isoWeekMonday(Number(ano), Number(semana));
    const dateStr = new Date(ts).toISOString().slice(0, 10);
    process.stdout.write(`\r[${i + 1}/${tasks.length}] ${dateStr} | ${t.name.slice(0, 40).padEnd(40)}`);

    if (!DRY_RUN) {
      try {
        await cuFetch(`/task/${t.id}/field/${FIELD_DATA}`, {
          method: 'POST',
          body: { value: ts },
        });
        ok++;
      } catch (e) {
        console.log(`\n  ⚠ erro em ${t.id}: ${e.message}`);
        err++;
      }
    } else {
      ok++;
    }
  }

  console.log(`\n\nConcluído: ${ok} atualizados, ${skip} pulados (sem dados), ${err} erros`);
}

main().catch(e => { console.error(e); process.exit(1); });
