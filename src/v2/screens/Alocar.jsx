import { useState, useEffect, useCallback, useRef } from 'react';
import { getISOWeek, getMonth, getYear } from 'date-fns';
import { loadForWeek, upsertForecast, upsertConsolidated, deleteRow as cuDeleteRow } from '../../lib/clickup/entries.js';
import { projects as cuProjects } from '../../lib/clickup/lists.js';
import { getWeekCap } from '../lib/feriados.js';
import PersonCard from '../components/PersonCard.jsx';

// Semanas ISO que pertencem a um dado mês/ano (pelo critério da quinta-feira).
function weeksOfMonth(year, month) {
  const weeks = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const w = getISOWeek(d);
    const wy = d.getDay() === 4
      ? d.getFullYear()
      : (w === 1 && d.getMonth() === 11) ? d.getFullYear() + 1
      : (w >= 52 && d.getMonth() === 0) ? d.getFullYear() - 1
      : d.getFullYear();
    const key = `${wy}-${w}`;
    if (!weeks.find(x => x.key === key)) weeks.push({ year: wy, week: w, key });
    d.setDate(d.getDate() + 1);
  }
  return weeks;
}

function uid() { return Math.random().toString(36).slice(2); }

const PROJ_CACHE_KEY   = 'ts:cache:projects:v2';
const CC_MAP_CACHE_KEY = 'ts:cache:projectToCc:v1'; // compartilhado com V1
const CACHE_TTL = 5 * 60 * 1000;

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}
function isCacheFresh(c) { return c?.savedAt && (Date.now() - c.savedAt) < CACHE_TTL; }

function blankRow() {
  return { id: uid(), project: '', businessUnit: '', hours_forecast: '', hours_consolidated: '' };
}

export default function Alocar({ people, year, week }) {
  const cap = getWeekCap(year, week);

  // groups: Map<personName, { rows, loading, saving }>
  const [groups, setGroups]         = useState({});
  const [projects, setProjects]     = useState([]);
  const [projectToCc, setProjectToCc] = useState(() => {
    // Reutiliza o mapa já construído pelo V1 (mesmo cache key)
    try { return JSON.parse(localStorage.getItem(CC_MAP_CACHE_KEY) || 'null')?.data ?? {}; }
    catch { return {}; }
  });
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [toast, setToast]           = useState(null);
  const [collapseAllToggle, setCollapseAllToggle] = useState(null); // 'collapse' | 'expand' | null
  const [monthData, setMonthData]     = useState({}); // personName → rows[]
  const [loadingMonth, setLoadingMonth] = useState(false);
  const savingRef = useRef({});
  const weekRef   = useRef({ year, week });

  function mergeIntoCcMap(rows) {
    if (!rows?.length) return;
    setProjectToCc(prev => {
      const votes = {};
      Object.entries(prev).forEach(([p, cc]) => { votes[p] = { [cc]: 1 }; });
      rows.forEach(r => {
        if (!r.Project || !r.Business_Unit) return;
        votes[r.Project] ??= {};
        votes[r.Project][r.Business_Unit] = (votes[r.Project][r.Business_Unit] || 0) + 1;
      });
      const next = { ...prev };
      Object.entries(votes).forEach(([proj, counts]) => {
        next[proj] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      });
      return next;
    });
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Carrega lista de projetos ativos (com cache)
  useEffect(() => {
    const cached = safeJsonParse(localStorage.getItem(PROJ_CACHE_KEY), null);
    if (isCacheFresh(cached) && Array.isArray(cached.data)) {
      setProjects(cached.data);
      return;
    }
    cuProjects.loadAll()
      .then(data => {
        const names = data.map(p => p.name);
        setProjects(names);
        localStorage.setItem(PROJ_CACHE_KEY, JSON.stringify({ data: names, savedAt: Date.now() }));
      })
      .catch(e => console.warn('Erro ao carregar projetos:', e));
  }, []);

  // Carrega dados da semana quando week/year muda ou people muda
  const loadWeekData = useCallback(async (yr, wk, peopleList) => {
    if (!peopleList.length) return;
    weekRef.current = { year: yr, week: wk };
    setLoadingWeek(true);

    // Inicializa todos os grupos com loading=true
    const initial = {};
    for (const p of peopleList) {
      initial[p.name] = { rows: [blankRow()], loading: true, saving: false };
    }
    setGroups(initial);

    try {
      const allRows = await loadForWeek(yr, wk);

      // Se a semana mudou enquanto carregava, descarta
      if (weekRef.current.year !== yr || weekRef.current.week !== wk) return;

      mergeIntoCcMap(allRows);

      setGroups(prev => {
        const next = { ...prev };
        for (const p of peopleList) {
          const mine = allRows.filter(r => r.Person === p.name);
          next[p.name] = {
            rows: mine.length
              ? mine.map(r => ({
                  id: uid(),
                  _taskId: r._taskId ?? null,
                  _year: r.Year,
                  _week: r.ISO_Week,
                  _person: r.Person,
                  project: r.Project,
                  businessUnit: r.Business_Unit || '',
                  hours_forecast: r.Hours_Forecast ?? '',
                  hours_consolidated: r.Hours_Consolidated ?? '',
                }))
              : [blankRow()],
            loading: false,
            saving: false,
          };
        }
        return next;
      });
    } catch (e) {
      console.warn('Erro ao carregar semana:', e);
      showToast('Erro ao carregar dados da semana.');
      setGroups(prev => {
        const next = { ...prev };
        for (const p of peopleList) {
          if (next[p.name]) next[p.name] = { ...next[p.name], loading: false };
        }
        return next;
      });
    } finally {
      setLoadingWeek(false);
    }
  }, []);

  useEffect(() => {
    loadWeekData(year, week, people);
  }, [year, week, people, loadWeekData]);

  // Carrega acumulado do mês (lazy, por trás da seção "Acumulado do mês" de cada card)
  useEffect(() => {
    if (!people.length) return;
    const selDate = new Date(year, 0, 4 + (week - 1) * 7); // aprox. data da semana
    const month = getMonth(selDate);
    const monthYear = getYear(selDate);
    const weeks = weeksOfMonth(monthYear, month);

    setLoadingMonth(true);
    setMonthData({});

    Promise.all(weeks.map(w => loadForWeek(w.year, w.week)))
      .then(results => {
        const allRows = results.flat();
        const byPerson = {};
        for (const p of people) {
          byPerson[p.name] = allRows.filter(r => r.Person === p.name);
        }
        setMonthData(byPerson);
      })
      .catch(e => console.error('[Alocar] loadMonth error:', e))
      .finally(() => setLoadingMonth(false));
  }, [year, week, people]);

  function setPersonRows(personName, rows) {
    setGroups(prev => ({
      ...prev,
      [personName]: { ...prev[personName], rows },
    }));
  }

  async function deletePersonRow(personName, row) {
    // Remove do estado local imediatamente
    setGroups(prev => {
      const g = prev[personName];
      if (!g) return prev;
      const remaining = g.rows.filter(r => r.id !== row.id);
      return {
        ...prev,
        [personName]: {
          ...g,
          rows: remaining.length ? remaining : [blankRow()],
        },
      };
    });

    // Se a linha não existe no ClickUp ainda (sem _taskId), nada a deletar
    if (!row._taskId && !row.project) return;
    if (!row._taskId) {
      // Tenta resolver pelo nome da task
      const entryRow = {
        _taskId: null,
        Year: row._year ?? year,
        ISO_Week: row._week ?? week,
        Person: personName,
        Project: row.project,
      };
      try { await cuDeleteRow(entryRow); } catch (e) { console.warn('delete sem _taskId:', e); }
      return;
    }

    try {
      await cuDeleteRow({ _taskId: row._taskId, Year: row._year, ISO_Week: row._week, Person: personName, Project: row.project });
    } catch (e) {
      console.error('[Alocar] deleteRow error:', e);
      showToast(`Erro ao deletar: ${e.message || 'verifique o console'}`);
    }
  }

  async function savePerson(person) {
    if (savingRef.current[person.name]) return;
    const g = groups[person.name];
    if (!g) return;

    const validRows = g.rows.filter(r =>
      r.project && (Number(r.hours_forecast) > 0 || Number(r.hours_consolidated) > 0)
    );
    if (!validRows.length) { showToast('Preencha ao menos uma linha com projeto e horas.'); return; }

    savingRef.current[person.name] = true;
    setGroups(prev => ({ ...prev, [person.name]: { ...prev[person.name], saving: true } }));

    try {
      const allRows = validRows.map(r => ({
        Year: year, ISO_Week: week,
        Person: person.name, Project: r.project, Business_Unit: r.businessUnit,
        Hours_Forecast:     Number(r.hours_forecast)     || null,
        Hours_Consolidated: Number(r.hours_consolidated) || null,
      }));
      const forecastRows     = allRows.filter(r => r.Hours_Forecast != null);
      const consolidatedRows = allRows.filter(r => r.Hours_Consolidated != null);
      if (forecastRows.length)     await upsertForecast(forecastRows);
      if (consolidatedRows.length) await upsertConsolidated(consolidatedRows);
      showToast(`${person.name} — ${allRows.length} linha${allRows.length > 1 ? 's' : ''} salva${allRows.length > 1 ? 's' : ''}.`);
    } catch (e) {
      console.error('[Alocar] savePerson error:', e);
      showToast(`Erro ao salvar: ${e.message || 'verifique o console'}`);
    } finally {
      savingRef.current[person.name] = false;
      setGroups(prev => ({ ...prev, [person.name]: { ...prev[person.name], saving: false } }));
    }
  }

  async function saveAll() {
    const toSave = people.filter(p => {
      const g = groups[p.name];
      return g && !g.loading && !g.saving && g.rows.some(r => r.project && (Number(r.hours_forecast) > 0 || Number(r.hours_consolidated) > 0));
    });
    if (!toSave.length) { showToast('Nenhuma linha preenchida para salvar.'); return; }
    await Promise.all(toSave.map(p => savePerson(p)));
  }

  // KPIs globais
  const totalF = people.reduce((s, p) => {
    const g = groups[p.name];
    return s + (g?.rows || []).reduce((rs, r) => rs + (Number(r.hours_forecast) || 0), 0);
  }, 0);
  const totalC = people.reduce((s, p) => {
    const g = groups[p.name];
    return s + (g?.rows || []).reduce((rs, r) => rs + (Number(r.hours_consolidated) || 0), 0);
  }, 0);
  const comGap = people.filter(p => {
    const g = groups[p.name];
    if (!g || g.loading) return false;
    const f = g.rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
    return f > 0 && f < cap;
  }).length;
  const fechados = people.filter(p => {
    const g = groups[p.name];
    if (!g || g.loading) return false;
    const f = g.rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
    const c = g.rows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
    return f > 0 && c >= f;
  }).length;
  const semAlocacao = people.filter(p => {
    const g = groups[p.name];
    if (!g || g.loading) return false;
    return g.rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0) === 0;
  }).length;

  if (!people.length) {
    return (
      <div className="p-8 text-center text-[var(--text-2)]">
        <p className="text-sm">Selecione uma unidade ou aguarde o carregamento das pessoas.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-20 space-y-4">
      {/* KPIs */}
      {(totalF > 0 || totalC > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Previstas', value: `${totalF}h` },
            { label: 'Realizadas', value: `${totalC}h` },
            { label: 'Com gap', value: comGap },
            { label: 'Sem alocação', value: semAlocacao },
            { label: 'Fechados', value: fechados },
          ].map(k => (
            <div key={k.label} className="rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] p-3 text-center">
              <div className="text-xl font-semibold tabular-nums text-[var(--text-1)]">{k.value}</div>
              <div className="text-xs text-[var(--text-2)] mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex justify-end items-center gap-2">
        <button
          onClick={() => setCollapseAllToggle('collapse')}
          className="text-xs text-[var(--text-2)] hover:text-[var(--accent)] transition-colors"
        >
          Colapsar tudo
        </button>
        <span className="text-[var(--border-subtle)]">·</span>
        <button
          onClick={() => setCollapseAllToggle('expand')}
          className="text-xs text-[var(--text-2)] hover:text-[var(--accent)] transition-colors"
        >
          Expandir tudo
        </button>
        <button
          onClick={saveAll}
          className="ml-2 text-sm px-4 py-1.5 rounded-full border border-[var(--accent)] text-[var(--accent)] font-medium hover:bg-[var(--accent)] hover:text-white transition-colors"
        >
          → Salvar tudo
        </button>
      </div>

      {/* Cards por pessoa */}
      {loadingWeek && (
        <div className="text-sm text-[var(--text-2)] animate-pulse">Carregando semana…</div>
      )}

      {people.map(person => {
        const g = groups[person.name] || { rows: [blankRow()], loading: false, saving: false };
        return (
          <div key={person.name}>
            {g.loading ? (
              <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-1)]">{person.name}</span>
                  <span className="text-xs text-[var(--text-2)] animate-pulse">carregando…</span>
                </div>
              </div>
            ) : (
              <PersonCard
                person={person}
                rows={g.rows}
                projects={projects}
                projectToCc={projectToCc}
                cap={cap}
                onChange={rows => setPersonRows(person.name, rows)}
                onDeleteRow={row => deletePersonRow(person.name, row)}
                onSave={() => savePerson(person)}
                saving={g.saving}
                forceCollapsed={collapseAllToggle}
                monthRows={monthData[person.name] || null}
                monthLoading={loadingMonth}
              />
            )}
          </div>
        );
      })}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[var(--text-1)] text-[var(--canvas)] text-sm font-medium shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
