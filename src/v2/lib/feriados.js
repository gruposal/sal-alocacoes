const STORAGE_KEY = 'ts:feriados:v1';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function weekKey(year, week) {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getFeriado(year, week) {
  return load()[weekKey(year, week)] ?? 0;
}

export function setFeriado(year, week, dias) {
  const data = load();
  const key = weekKey(year, week);
  if (dias === 0) delete data[key];
  else data[key] = dias;
  save(data);
}

export function getWeekCap(year, week) {
  return 40 - (getFeriado(year, week) * 8);
}
