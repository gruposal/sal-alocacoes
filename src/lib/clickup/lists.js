import { cuFetch } from './client.js';
import { LIST_PEOPLE, LIST_PROJECTS, LIST_DIRETORIO, PEOPLE_FIELDS, DIRETORIO_FIELDS } from './fields.js';

async function loadList(listId, filter = null, includeClosed = true) {
  const rows = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${listId}/task?page=${page}&limit=100&include_closed=${includeClosed}`);
    let tasks = data.tasks || [];
    if (filter) tasks = tasks.filter(filter);
    rows.push(...tasks.map(t => ({ id: t.id, name: t.name })));
    if (data.last_page || (data.tasks || []).length === 0) break;
    page++;
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// IDs dos custom fields da LISTA_PROJETOS (descobertos via clickup_get_custom_fields).
const PROJ_FIELD_IDS = {
  cliente:        '639c7bb2-4c4f-4298-b644-349c5e033c93',
  centro_custo:   '02320ff2-3cca-4ad0-b5e0-c7dd3d10e925',
  categoria:      'ff1a14ab-5650-405f-ad46-56d840cf014e',
  formato:        '00d86894-e3b5-484b-b882-c7d7634b06de',
};

// Extrai metadados úteis de uma task de projeto. Retorna { name, cliente, centroCusto, categoria, formato, isInterno }.
function extractProjectMeta(task) {
  const cf = task.custom_fields || [];
  function dropdownName(fieldId) {
    const f = cf.find(x => x.id === fieldId);
    if (!f || f.value == null) return null;
    // ClickUp pode entregar value como índice (orderindex) OU como ID da opção
    const opts = f.type_config?.options || [];
    if (typeof f.value === 'number') {
      return opts.find(o => o.orderindex === f.value)?.name ?? null;
    }
    return opts.find(o => o.id === f.value)?.name ?? null;
  }
  function textValue(fieldId) {
    const f = cf.find(x => x.id === fieldId);
    return (f?.value ?? '').toString().trim() || null;
  }
  const categoria = dropdownName(PROJ_FIELD_IDS.categoria);
  const formato   = dropdownName(PROJ_FIELD_IDS.formato);
  const rawStatus = task.status;
  const statusStr = typeof rawStatus === 'string' ? rawStatus : rawStatus?.status;
  return {
    id: task.id,
    name: (task.name || '').trim(),
    status: statusStr?.toLowerCase() ?? null,
    cliente:      textValue(PROJ_FIELD_IDS.cliente),
    centroCusto:  dropdownName(PROJ_FIELD_IDS.centro_custo),
    categoria,
    formato,
    isInterno: categoria === 'Interno' || formato === 'Interno',
  };
}

// Carrega LISTA_PROJETOS com custom fields. Usado pelo Dashboard pra cruzar Cliente/Categoria.
async function loadProjectsWithMeta() {
  const rows = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${LIST_PROJECTS}/task?page=${page}&limit=100&include_closed=true`);
    rows.push(...(data.tasks || []).map(extractProjectMeta));
    if (data.last_page || (data.tasks || []).length === 0) break;
    page++;
  }
  return rows;
}

async function addItem(listId, name) {
  const task = await cuFetch(`/list/${listId}/task`, {
    method: 'POST',
    body: { name },
  });
  return { id: task.id, name: task.name };
}

async function renameItem(taskId, name) {
  await cuFetch(`/task/${taskId}`, {
    method: 'PUT',
    body: { name },
  });
}

async function deleteItem(taskId) {
  await cuFetch(`/task/${taskId}`, { method: 'DELETE' });
}

// Carrega pessoas do Diretório de Salgados com o campo Unidade de negócio (labels).
// Retorna [{ id, name, unidade }]. Somente ativos (include_closed=false).
async function loadPeopleWithMeta() {
  const tasks = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${LIST_DIRETORIO}/task?page=${page}&limit=100&include_closed=false`);
    tasks.push(...(data.tasks || []));
    if (data.last_page || !(data.tasks || []).length) break;
    page++;
  }
  return tasks
    .map(t => {
      const cf = t.custom_fields || [];
      const uField = cf.find(f => f.id === DIRETORIO_FIELDS.unidade);
      let unidade = null;
      if (uField && Array.isArray(uField.value) && uField.value.length > 0) {
        // labels retorna array de objetos { id, label } ou array de IDs
        const first = uField.value[0];
        unidade = first?.label ?? first?.name ?? null;
        if (!unidade && typeof first === 'string') {
          const opts = uField.type_config?.options || [];
          unidade = opts.find(o => o.id === first)?.label ?? null;
        }
      }
      return { id: t.id, name: (t.name || '').trim(), unidade };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export const people = {
  loadAll: () => loadList(LIST_DIRETORIO, null, false),
  loadAllWithMeta: loadPeopleWithMeta,
  // Não auto-criar pessoas no Diretório — cadastro é manual no ClickUp.
  add: _name => Promise.reject(new Error('Cadastro de pessoas é feito diretamente no Diretório de Salgados (ClickUp).')),
  rename: (id, name) => renameItem(id, name),
  remove: id => deleteItem(id),
};

export const projects = {
  loadAll: () => loadList(LIST_PROJECTS, t => {
    const s = typeof t.status === 'string' ? t.status : t.status?.status;
    return s?.toLowerCase() !== 'concluído';
  }),
  loadAllWithMeta: loadProjectsWithMeta,
  add: name => addItem(LIST_PROJECTS, name),
  rename: (id, name) => renameItem(id, name),
  remove: id => deleteItem(id),
};
