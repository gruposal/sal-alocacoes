import { cuFetch } from './client.js';
import { LIST_ENTRIES, LIST_PROJECTS, LIST_DIRETORIO, FIELDS, ccIdToName, ccNameToId } from './fields.js';
import { projects } from './lists.js';

// session cache: task name → clickup task id
const taskIdCache    = new Map();
const personIdCache  = new Map(); // person name → clickup task id (Diretório de Salgados)
const projectIdCache = new Map(); // project name → clickup task id (LISTA_PROJETOS)

async function fetchAllFromList(listId, includeClosed = true) {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${listId}/task?page=${page}&limit=100&include_closed=${includeClosed}`);
    tasks.push(...(data.tasks || []));
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  return tasks;
}

async function ensurePersonCache() {
  if (personIdCache.size > 0) return;
  // Carrega o Diretório de Salgados (ativos). Include_closed=false — pessoas desligadas
  // não devem aparecer no seletor nem receber novas alocações.
  const tasks = await fetchAllFromList(LIST_DIRETORIO, false);
  tasks.forEach(t => personIdCache.set(t.name.trim(), t.id));
}

async function ensureProjectCache() {
  if (projectIdCache.size > 0) return;
  const tasks = await fetchAllFromList(LIST_PROJECTS);
  tasks.forEach(t => projectIdCache.set(t.name.trim(), t.id));
}

// Normaliza nome para comparação: remove acentos e lowercase. Evita duplicatas tipo
// "Edilson Junior" vs "Edilson Júnior" criarem 2 registros.
function normalizeName(s) {
  return (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function findInCache(cache, name) {
  if (cache.has(name)) return cache.get(name);
  const norm = normalizeName(name);
  for (const [k, v] of cache) {
    if (normalizeName(k) === norm) return v;
  }
  return null;
}

// Resolve o ID do colaborador no Diretório de Salgados. Match insensível a acentos.
// NÃO auto-cria — o Diretório é gerenciado manualmente no ClickUp.
// Lança erro se a pessoa não existir (fail fast: alocação sem vínculo é inválida).
export async function ensurePerson(name) {
  const clean = (name || '').trim();
  if (!clean) throw new Error('ensurePerson: nome vazio');
  await ensurePersonCache();
  const found = findInCache(personIdCache, clean);
  if (found) return found;
  throw new Error(`Pessoa "${clean}" não encontrada no Diretório de Salgados. Cadastre-a no ClickUp antes de lançar a alocação.`);
}

// Auto-cria projeto em LISTA_PROJETOS se não existir. Idempotente via cache de sessão.
// Match insensível a acentos pelo mesmo motivo de ensurePerson.
export async function ensureProject(name) {
  const clean = (name || '').trim();
  if (!clean) throw new Error('ensureProject: nome vazio');
  await ensureProjectCache();
  const found = findInCache(projectIdCache, clean);
  if (found) return found;
  const created = await projects.add(clean);
  projectIdCache.set(clean, created.id);
  return created.id;
}

// Retorna timestamp (ms) da segunda-feira de uma semana ISO.
// Jan 4 é sempre semana 1 (ISO 8601). Usa hora 12 para evitar ambiguidade de DST.
function isoWeekMonday(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7; // 0=Dom→7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  monday.setHours(12, 0, 0, 0);
  return monday.getTime();
}

export function makeTaskName(year, isoWeek, person, project) {
  const week = String(isoWeek).padStart(2, '0');
  return `${year}-W${week} | ${person} | ${project}`;
}

function parsePersonProject(taskName) {
  // Formato canônico: "2026-W16 | Pessoa | Projeto"
  const m = taskName.match(/^\d{4}-W\d{2}\s*\|\s*(.+?)\s*\|\s*(.+)$/);
  if (m) return { person: m[1].trim(), project: m[2].trim() };
  // Formato legado: "Pessoa → Projeto (Sem N)"
  const old = taskName.match(/^(.+?)\s*→\s*(.+?)(?:\s*\(Sem \d+\))?$/);
  if (old) return { person: old[1].trim(), project: old[2].trim() };
  return null;
}

function fromTask(task) {
  const cf = Object.fromEntries(
    (task.custom_fields || []).map(f => [f.id, f.value ?? null])
  );

  // Dropdown returns orderindex (number), not UUID — resolve name from type_config
  const ccField = (task.custom_fields || []).find(f => f.id === FIELDS.centro_de_custo);
  let businessUnit = '';
  if (ccField && ccField.value != null) {
    const opt = (ccField.type_config?.options || []).find(o => o.orderindex === ccField.value);
    businessUnit = opt?.name ?? ccIdToName(ccField.value) ?? '';
  }

  // Person/Project: relationship fields são a fonte primária (refletem o nome atual).
  // Fallback: parsear do título da task → campos-texto legados.
  const relProj  = cf[FIELDS.rel_projeto];
  const relColab = cf[FIELDS.rel_colaborador_novo];
  const parsed   = parsePersonProject(task.name);
  const person  = (Array.isArray(relColab) && relColab[0]?.name) ? relColab[0].name
                : parsed?.person  ?? cf[FIELDS.pessoa]  ?? '';
  const project = (Array.isArray(relProj)  && relProj[0]?.name)  ? relProj[0].name
                : parsed?.project ?? cf[FIELDS.projeto] ?? '';

  const entry = {
    ID: task.name,
    _taskId: task.id,
    Year: cf[FIELDS.ano] !== null ? Number(cf[FIELDS.ano]) : null,
    ISO_Week: cf[FIELDS.semana_num] !== null ? Number(cf[FIELDS.semana_num]) : null,
    Person: person,
    Project: project,
    Business_Unit: businessUnit,
    Hours_Forecast: cf[FIELDS.horas_previstas] !== null ? Number(cf[FIELDS.horas_previstas]) : null,
    Hours_Consolidated: cf[FIELDS.horas_realizadas] !== null ? Number(cf[FIELDS.horas_realizadas]) : null,
  };

  taskIdCache.set(task.name, task.id);
  return entry;
}

async function fetchPage(filters, page = 0) {
  const cf = encodeURIComponent(JSON.stringify(filters));
  const data = await cuFetch(
    `/list/${LIST_ENTRIES}/task?custom_fields=${cf}&page=${page}&limit=100&include_closed=true`
  );
  return data;
}

export async function loadForWeek(year, isoWeek) {
  const filters = [
    { field_id: FIELDS.ano,        operator: '=', value: year },
    { field_id: FIELDS.semana_num, operator: '=', value: isoWeek },
  ];
  const rows = [];
  let page = 0;
  while (true) {
    const data = await fetchPage(filters, page);
    rows.push(...(data.tasks || []).map(fromTask));
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  return rows;
}

// Filtra direto na API pelas entries de uma única pessoa (relationship field).
// Operator "=" no rel_colaborador_novo é ignorado pelo ClickUp (retorna todo mundo);
// só "ANY" com value em array filtra de verdade — testado contra a API real.
export async function loadForPersonWeek(year, isoWeek, personId) {
  const filters = [
    { field_id: FIELDS.ano,                operator: '=',   value: year },
    { field_id: FIELDS.semana_num,         operator: '=',   value: isoWeek },
    { field_id: FIELDS.rel_colaborador_novo, operator: 'ANY', value: [personId] },
  ];
  const rows = [];
  let page = 0;
  while (true) {
    const data = await fetchPage(filters, page);
    rows.push(...(data.tasks || []).map(fromTask));
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  return rows;
}

export async function loadLastYear(year, { onProgress } = {}) {
  const filters = [
    { field_id: FIELDS.ano, operator: '=', value: year },
  ];
  const rows = [];
  let page = 0;
  const MAX_PAGES = 30;
  while (page < MAX_PAGES) {
    let data;
    try {
      data = await fetchPage(filters, page);
    } catch (e) {
      // Página falhou (timeout ou erro de rede) — retorna o que temos até agora
      console.warn(`loadLastYear: página ${page} falhou, retornando ${rows.length} registros parciais.`, e);
      break;
    }
    const batch = (data.tasks || []).map(fromTask);
    rows.push(...batch);
    if (onProgress) onProgress(rows.length);
    if (data.last_page || batch.length === 0) break;
    page++;
  }
  return rows;
}

async function setField(taskId, fieldId, value) {
  await cuFetch(`/task/${taskId}/field/${fieldId}`, {
    method: 'POST',
    body: { value },
  });
}

export async function createEntry(row) {
  const name = makeTaskName(row.Year, row.ISO_Week, row.Person, row.Project);
  const ccOptionId = row.Business_Unit ? ccNameToId(row.Business_Unit) : null;

  // Garante que pessoa e projeto existem ANTES de criar a entry — falha fast se não puder.
  // Em 2027+ isso significa que projetos novos são cadastrados on demand sem cadastro manual.
  const [personId, projectId] = await Promise.all([
    ensurePerson(row.Person),
    ensureProject(row.Project),
  ]);

  const task = await cuFetch(`/list/${LIST_ENTRIES}/task`, {
    method: 'POST',
    body: {
      name,
      custom_fields: [
        { id: FIELDS.ano,              value: row.Year },
        { id: FIELDS.semana_num,       value: row.ISO_Week },
        { id: FIELDS.data_inicio,      value: isoWeekMonday(row.Year, row.ISO_Week) },
        ...(ccOptionId ? [{ id: FIELDS.centro_de_custo, value: ccOptionId }] : []),
        { id: FIELDS.horas_previstas,  value: row.Hours_Forecast ?? null },
        { id: FIELDS.horas_realizadas, value: row.Hours_Consolidated ?? null },
      ],
    },
  });

  taskIdCache.set(name, task.id);

  await setField(task.id, FIELDS.rel_colaborador_novo, { add: [personId] });
  await setField(task.id, FIELDS.rel_projeto,          { add: [projectId] });

  return task.id;
}

export async function upsertForecast(rows) {
  for (const row of rows) {
    const taskId = row._taskId || await resolveTaskId(makeTaskName(row.Year, row.ISO_Week, row.Person, row.Project));

    if (taskId) {
      await setField(taskId, FIELDS.horas_previstas, row.Hours_Forecast);
      if (row.Business_Unit) {
        const optId = ccNameToId(row.Business_Unit);
        if (optId) await setField(taskId, FIELDS.centro_de_custo, optId);
      }
    } else {
      await createEntry(row);
    }
  }
}

async function resolveTaskId(name) {
  // Tenta cache primeiro; se não tiver, busca no ClickUp pelo nome exato
  const cached = taskIdCache.get(name);
  if (cached) return cached;
  const data = await cuFetch(`/list/${LIST_ENTRIES}/task?name=${encodeURIComponent(name)}&include_closed=true`);
  const task = (data.tasks || []).find(t => t.name === name);
  if (!task) return null;
  taskIdCache.set(name, task.id);
  return task.id;
}

export async function upsertConsolidated(rows) {
  for (const row of rows) {
    let taskId = row._taskId || await resolveTaskId(makeTaskName(row.Year, row.ISO_Week, row.Person, row.Project));
    if (!taskId) {
      // Task não existe ainda — cria com forecast null e consolidated preenchido
      taskId = await createEntry({ ...row, Hours_Forecast: row.Hours_Forecast ?? null });
    }
    await setField(taskId, FIELDS.horas_realizadas, row.Hours_Consolidated);
  }
}

export async function deleteRow(row) {
  const name = makeTaskName(row.Year, row.ISO_Week, row.Person, row.Project);
  // Prefere _taskId do objeto (identifica a instância exata) — evita usar cache
  // que pode apontar para uma duplicata já deletada.
  const taskId = row._taskId || taskIdCache.get(name) || await resolveTaskId(name);
  if (!taskId) throw new Error(`Task não encontrada para remoção: ${name}`);
  await cuFetch(`/task/${taskId}`, { method: 'DELETE' });
  if (taskIdCache.get(name) === taskId) taskIdCache.delete(name);
}
