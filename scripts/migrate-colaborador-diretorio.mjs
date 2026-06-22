/**
 * Migra o campo Colaborador nas alocações: LISTA_PESSOAS → Diretório de Salgados
 *
 * Dry-run (padrão): só conta e imprime não-casados.
 * Gravação real:    node scripts/migrate-colaborador-diretorio.mjs --write
 *
 * Regras de segurança (handoff):
 *  - NUNCA deleta nada
 *  - Só adiciona valor ao campo NOVO (a8f17cd8); não altera campo ANTIGO nem outros
 *  - Idempotente: pula se campo NOVO já tiver o diretorioTaskId correto
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
if (!TOKEN) { console.error('VITE_CLICKUP_TOKEN não encontrado em .env.local'); process.exit(1); }

const DRY_RUN = !process.argv.includes('--write');

const LIST_ENTRIES    = '901326824645'; // Registro de Alocações
const LIST_DIRETORIO  = '198927200';    // Diretório de Salgados
const LIST_PESSOAS    = '901326824643'; // LISTA_PESSOAS (legado, origem)
const FIELD_COLAB_OLD = 'dcd6eb4f-4e04-405d-93dd-8cedb3765938'; // relationship → LISTA_PESSOAS
const FIELD_COLAB_NEW = 'a8f17cd8-9b6d-45ac-9291-f4be28ab05a7'; // relationship → Diretório

// Override manual: casos onde o nome diverge entre as duas listas
// Maria Erlangia Marçal dos Santos (LISTA) ↔ Erlanja Santos (Diretório)
// Descomente a linha abaixo SOMENTE após confirmação do Juarez:
// const NAME_OVERRIDES = { 'maria erlangia marcal dos santos': '2pxw30f' };
const NAME_OVERRIDES = {};

const BASE = 'https://api.clickup.com/api/v2';
const headers = { Authorization: TOKEN, 'Content-Type': 'application/json' };

async function cuFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers, ...opts });
  if (res.status === 429) {
    const retry = Number(res.headers.get('Retry-After') || 3);
    console.log(`  Rate limit — aguardando ${retry}s...`);
    await new Promise(r => setTimeout(r, retry * 1000));
    return cuFetch(path, opts);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAllTasks(listId) {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(
      `/list/${listId}/task?page=${page}&limit=100&include_closed=true`
    );
    tasks.push(...(data.tasks || []));
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  return tasks;
}

function normalize(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, '')     // remove pontuação
    .replace(/\s+/g, ' ')
    .trim();
}

function parseName(taskName) {
  // Formato: "2026-W16 | Pessoa | Projeto"
  const m = taskName.match(/^\d{4}-W\d{2}\s*\|\s*(.+?)\s*\|\s*(.+)$/);
  if (m) return m[1].trim();
  // Formato legado: "Pessoa → Projeto (Sem N)"
  const old = taskName.match(/^(.+?)\s*→\s*/);
  if (old) return old[1].trim();
  return null;
}

function getFieldValue(task, fieldId) {
  const field = (task.custom_fields || []).find(f => f.id === fieldId);
  return field?.value ?? null;
}

async function main() {
  console.log(DRY_RUN
    ? '=== DRY-RUN (nenhuma gravação) ===\n'
    : '=== MODO ESCRITA ===\n');

  // 1. Mapa Diretório: nomeNormalizado → taskId
  console.log('Carregando Diretório de Salgados...');
  const diretorioTasks = await fetchAllTasks(LIST_DIRETORIO);
  const diretorioMap = new Map(
    diretorioTasks.map(t => [normalize(t.name), t.id])
  );
  console.log(`  ${diretorioTasks.length} registros no Diretório.\n`);

  // 2. Mapa LISTA_PESSOAS: taskId → nomeNormalizado
  console.log('Carregando LISTA_PESSOAS...');
  const pessoasTasks = await fetchAllTasks(LIST_PESSOAS);
  const pessoasMap = new Map(
    pessoasTasks.map(t => [t.id, { norm: normalize(t.name), raw: t.name }])
  );
  console.log(`  ${pessoasTasks.length} pessoas na LISTA_PESSOAS.\n`);

  // 3. Iterar alocações
  console.log('Carregando Registro de Alocações...');
  const entries = await fetchAllTasks(LIST_ENTRIES);
  console.log(`  ${entries.length} alocações encontradas.\n`);

  let countMigrar   = 0; // seria migrado (dry) ou migrado (write)
  let countJaOk     = 0; // já tem o campo NOVO correto — pular
  let countSemMatch = 0; // sem match no Diretório
  let countErro     = 0; // erro na API (apenas modo write)
  const naoCasados  = []; // { entry, nome, motivo }

  for (const entry of entries) {
    // a. Determinar o diretorioTaskId alvo

    // Tentar via campo ANTIGO (relationship → LISTA_PESSOAS)
    let listaPessoasId = null;
    const fieldOld = getFieldValue(entry, FIELD_COLAB_OLD);
    if (fieldOld && Array.isArray(fieldOld) && fieldOld.length > 0) {
      listaPessoasId = fieldOld[0]?.id ?? fieldOld[0];
    } else if (fieldOld && typeof fieldOld === 'object' && fieldOld.id) {
      listaPessoasId = fieldOld.id;
    }

    let nomeNorm = null;
    if (listaPessoasId && pessoasMap.has(listaPessoasId)) {
      nomeNorm = pessoasMap.get(listaPessoasId).norm;
    }

    // Fallback: parsear do nome da task
    if (!nomeNorm) {
      const parsed = parseName(entry.name);
      if (parsed) nomeNorm = normalize(parsed);
    }

    if (!nomeNorm) {
      naoCasados.push({ id: entry.id, nome: entry.name, motivo: 'nome não parseável' });
      countSemMatch++;
      continue;
    }

    // b. Resolver diretorioTaskId
    let diretorioTaskId = diretorioMap.get(nomeNorm) ?? NAME_OVERRIDES[nomeNorm] ?? null;

    if (!diretorioTaskId) {
      naoCasados.push({ id: entry.id, nome: entry.name, motivo: `pessoa "${nomeNorm}" sem match no Diretório` });
      countSemMatch++;
      continue;
    }

    // c. Verificar idempotência (campo NOVO já tem o valor correto?)
    const fieldNew = getFieldValue(entry, FIELD_COLAB_NEW);
    let jaTemValor = false;
    if (fieldNew && Array.isArray(fieldNew)) {
      jaTemValor = fieldNew.some(v => (v?.id ?? v) === diretorioTaskId);
    } else if (fieldNew && typeof fieldNew === 'object') {
      jaTemValor = (fieldNew?.id ?? fieldNew) === diretorioTaskId;
    }

    if (jaTemValor) {
      countJaOk++;
      continue;
    }

    // d. Gravar (ou simular em dry-run)
    countMigrar++;
    if (!DRY_RUN) {
      try {
        await cuFetch(`/task/${entry.id}/field/${FIELD_COLAB_NEW}`, {
          method: 'POST',
          body: JSON.stringify({ value: { add: [diretorioTaskId] } }),
        });
        if (countMigrar % 50 === 0) console.log(`  ${countMigrar} migrados...`);
      } catch (e) {
        console.error(`  ERRO em "${entry.name}" (${entry.id}): ${e.message}`);
        countErro++;
        countMigrar--;
      }
      await new Promise(r => setTimeout(r, 120)); // ~8 req/s
    }
  }

  // Relatório
  console.log('\n=== RESULTADO ===');
  if (DRY_RUN) {
    console.log(`  Seriam migrados:  ${countMigrar}`);
    console.log(`  Já OK (pulariam): ${countJaOk}`);
    console.log(`  Sem match:        ${countSemMatch}`);
    console.log(`  Total alocações:  ${entries.length}`);
  } else {
    console.log(`  Migrados:         ${countMigrar}`);
    console.log(`  Já OK (pulados):  ${countJaOk}`);
    console.log(`  Sem match:        ${countSemMatch}`);
    console.log(`  Erros API:        ${countErro}`);
    console.log(`  Total alocações:  ${entries.length}`);
  }

  if (naoCasados.length > 0) {
    console.log('\n--- NÃO-CASADOS ---');
    const grupos = {};
    for (const nc of naoCasados) {
      grupos[nc.motivo] = grupos[nc.motivo] || [];
      grupos[nc.motivo].push(nc);
    }
    for (const [motivo, lista] of Object.entries(grupos)) {
      console.log(`\n[${motivo}] (${lista.length} alocações)`);
      // Agrupar por nome de pessoa para não listar 100x a mesma pessoa
      const porPessoa = {};
      for (const nc of lista) {
        const chave = nc.motivo.includes('sem match') ? nc.motivo : nc.nome;
        porPessoa[chave] = (porPessoa[chave] || 0) + 1;
      }
      for (const [chave, qty] of Object.entries(porPessoa)) {
        console.log(`  ${qty}x  ${chave}`);
      }
      // Mostra 3 exemplos de task para referência
      console.log('  Exemplos:');
      lista.slice(0, 3).forEach(nc =>
        console.log(`    - [${nc.id}] ${nc.nome}`)
      );
    }
  } else {
    console.log('\n  Nenhum não-casado. ✓');
  }

  if (DRY_RUN) {
    console.log('\nPara gravar: node scripts/migrate-colaborador-diretorio.mjs --write');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
