import { cuFetch } from './client.js';
import { LIST_PEOPLE, LIST_PROJECTS } from './fields.js';

async function loadList(listId) {
  const rows = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${listId}/task?page=${page}&limit=100&include_closed=true`);
    rows.push(...(data.tasks || []).map(t => ({ id: t.id, name: t.name })));
    if (data.last_page || (data.tasks || []).length === 0) break;
    page++;
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// IDs dos custom fields da LISTA_PROJETOS (descobertos via clickup_get_custom_fields).
const PROJ_FIELD_IDS = {
  cliente:        '639c7bb2-4c4f-4298-b644-349c5e033c93',
  centro_custo:   '60ded30e-06fc-4cb8-9fe1-db0122a0b2f4',
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
  return {
    id: task.id,
    name: (task.name || '').trim(),
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

export const people = {
  loadAll: () => loadList(LIST_PEOPLE),
  add: name => addItem(LIST_PEOPLE, name),
  rename: (id, name) => renameItem(id, name),
  remove: id => deleteItem(id),
};

export const projects = {
  loadAll: () => loadList(LIST_PROJECTS),
  loadAllWithMeta: loadProjectsWithMeta,
  add: name => addItem(LIST_PROJECTS, name),
  rename: (id, name) => renameItem(id, name),
  remove: id => deleteItem(id),
};
