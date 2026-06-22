import { useState, useEffect, useMemo, useCallback } from 'react';
import { getISOWeek, getMonth, getYear } from 'date-fns';
import { loadForWeek, loadLastYear } from '../../lib/clickup/entries.js';
import { ccColor, CENTRO_DE_CUSTO_OPTIONS } from '../../lib/clickup/fields.js';

// ── Utils ────────────────────────────────────────────────────────────────────
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}
function isCacheFresh(c, ttl = 5 * 60 * 1000) {
  return c?.savedAt && (Date.now() - c.savedAt) < ttl;
}

function weeksOfMonth(year, month) {
  const weeks = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const w = getISOWeek(d);
    const wy = (w === 1 && d.getMonth() === 11) ? d.getFullYear() + 1
             : (w >= 52 && d.getMonth() === 0)  ? d.getFullYear() - 1
             : d.getFullYear();
    const key = `${wy}-${w}`;
    if (!weeks.find(x => x.key === key)) weeks.push({ year: wy, week: w, key });
    d.setDate(d.getDate() + 1);
  }
  return weeks;
}

// ── Aggregate helpers ─────────────────────────────────────────────────────────
function groupByProject(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.Project) continue;
    const g = map.get(r.Project) || { project: r.Project, cc: r.Business_Unit, totalF: 0, totalC: 0, people: new Map() };
    g.totalF += Number(r.Hours_Forecast) || 0;
    g.totalC += Number(r.Hours_Consolidated) || 0;
    if (r.Person) {
      const p = g.people.get(r.Person) || { name: r.Person, f: 0, c: 0 };
      p.f += Number(r.Hours_Forecast) || 0;
      p.c += Number(r.Hours_Consolidated) || 0;
      g.people.set(r.Person, p);
    }
    map.set(r.Project, g);
  }
  return [...map.values()]
    .map(g => ({ ...g, people: [...g.people.values()].sort((a, b) => b.f - a.f) }))
    .sort((a, b) => b.totalF - a.totalF);
}

function groupByPerson(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.Person) continue;
    const g = map.get(r.Person) || { person: r.Person, totalF: 0, totalC: 0, projects: new Map() };
    g.totalF += Number(r.Hours_Forecast) || 0;
    g.totalC += Number(r.Hours_Consolidated) || 0;
    if (r.Project) {
      const p = g.projects.get(r.Project) || { name: r.Project, cc: r.Business_Unit, f: 0, c: 0 };
      p.f += Number(r.Hours_Forecast) || 0;
      p.c += Number(r.Hours_Consolidated) || 0;
      g.projects.set(r.Project, p);
    }
    map.set(r.Person, g);
  }
  return [...map.values()]
    .map(g => ({ ...g, projects: [...g.projects.values()].sort((a, b) => b.f - a.f) }))
    .sort((a, b) => b.totalF - a.totalF);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function DesvioTag({ f, c }) {
  if (!f && !c) return null;
  const d = c - f;
  if (d === 0) return <span className="tabular-nums text-xs text-[var(--text-secondary)]">={c}h</span>;
  if (d > 0) return <span className="tabular-nums text-xs text-[var(--positive-text)]">+{d}h</span>;
  return <span className="tabular-nums text-xs text-[var(--negative-text)]">{d}h</span>;
}

function KpiStrip({ rows }) {
  const totalF = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const totalC = rows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
  const projetos = new Set(rows.map(r => r.Project).filter(Boolean)).size;
  const pessoas  = new Set(rows.map(r => r.Person).filter(Boolean)).size;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Previstas',   value: `${totalF}h` },
        { label: 'Realizadas',  value: `${totalC}h` },
        { label: 'Projetos',    value: projetos },
        { label: 'Pessoas',     value: pessoas },
      ].map(k => (
        <div key={k.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <div className="text-xl font-semibold tabular-nums text-[var(--text-primary)]">{k.value}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

// Visão Projetos
function ViewProjetos({ rows }) {
  const [expanded, setExpanded] = useState(null);
  const grouped = useMemo(() => groupByProject(rows), [rows]);

  if (!grouped.length) return <p className="py-8 text-center text-sm text-[var(--text-secondary)]">Sem dados para o período.</p>;

  return (
    <div className="space-y-1.5">
      {grouped.map(g => (
        <div key={g.project} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <button
            onClick={() => setExpanded(e => e === g.project ? null : g.project)}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--surface-raised)] transition-colors"
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ccColor(g.cc) }} />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm text-[var(--text-primary)] truncate block">{g.project}</span>
              <span className="text-xs text-[var(--text-secondary)]">{g.cc} · {g.people.length} pessoa{g.people.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0 tabular-nums text-sm">
              <span className="text-[var(--text-secondary)]">{g.totalF}h prev</span>
              <span className={g.totalC > 0 ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{g.totalC}h real</span>
              <DesvioTag f={g.totalF} c={g.totalC} />
              <span className="text-[var(--text-secondary)] text-xs">{expanded === g.project ? '▼' : '▶'}</span>
            </div>
          </button>
          {expanded === g.project && (
            <div className="border-t border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
              {g.people.map(p => (
                <div key={p.name} className="px-6 py-2 flex items-center gap-3 text-sm">
                  <span className="flex-1 text-[var(--text-secondary)]">{p.name}</span>
                  <span className="tabular-nums text-[var(--text-secondary)]">{p.f}h prev</span>
                  <span className={`tabular-nums ${p.c > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{p.c}h real</span>
                  <DesvioTag f={p.f} c={p.c} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Visão Individual
function ViewIndividual({ rows }) {
  const [mode, setMode] = useState('pessoa'); // 'pessoa' | 'projeto'
  const [selected, setSelected] = useState('');

  const byPerson  = useMemo(() => groupByPerson(rows), [rows]);
  const byProject = useMemo(() => groupByProject(rows), [rows]);

  const peopleNames  = useMemo(() => byPerson.map(g => g.person), [byPerson]);
  const projectNames = useMemo(() => byProject.map(g => g.project), [byProject]);

  const options = mode === 'pessoa' ? peopleNames : projectNames;

  // Reset seleção ao mudar modo
  const handleMode = (m) => { setMode(m); setSelected(''); };

  const personData  = mode === 'pessoa'  ? byPerson.find(g => g.person === selected)   : null;
  const projectData = mode === 'projeto' ? byProject.find(g => g.project === selected) : null;

  return (
    <div className="space-y-4">
      {/* Modo toggle */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-[2px] p-[3px] bg-[var(--surface-raised)] rounded-full">
          {['pessoa', 'projeto'].map(m => (
            <button key={m} onClick={() => handleMode(m)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all capitalize ${
                mode === m ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'
              }`}>
              Por {m}
            </button>
          ))}
        </div>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 sm:flex-none sm:min-w-[240px] text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">Selecionar {mode}…</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Resultado — por pessoa */}
      {personData && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 px-1">
            <h3 className="font-semibold text-[var(--text-primary)]">{personData.person}</h3>
            <span className="text-sm text-[var(--text-secondary)] tabular-nums">
              {personData.totalF}h prev · {personData.totalC}h real
            </span>
          </div>
          {personData.projects.map(p => (
            <div key={p.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ccColor(p.cc) }} />
              <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{p.name}</span>
              <span className="text-xs text-[var(--text-secondary)] shrink-0">{p.cc}</span>
              <div className="flex items-center gap-2 shrink-0 tabular-nums text-sm">
                <span className="text-[var(--text-secondary)]">{p.f}h prev</span>
                <span className={p.c > 0 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}>{p.c}h real</span>
                <DesvioTag f={p.f} c={p.c} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resultado — por projeto */}
      {projectData && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 px-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: ccColor(projectData.cc) }} />
            <h3 className="font-semibold text-[var(--text-primary)]">{projectData.project}</h3>
            <span className="text-xs text-[var(--text-secondary)]">{projectData.cc}</span>
            <span className="text-sm text-[var(--text-secondary)] tabular-nums ml-auto">
              {projectData.totalF}h prev · {projectData.totalC}h real
            </span>
          </div>
          {projectData.people.map(p => (
            <div key={p.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 flex items-center gap-3">
              <span className="flex-1 text-sm text-[var(--text-primary)]">{p.name}</span>
              <div className="flex items-center gap-2 shrink-0 tabular-nums text-sm">
                <span className="text-[var(--text-secondary)]">{p.f}h prev</span>
                <span className={p.c > 0 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}>{p.c}h real</span>
                <DesvioTag f={p.f} c={p.c} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!selected && (
        <p className="py-6 text-center text-sm text-[var(--text-secondary)]">
          Selecione um{mode === 'pessoa' ? 'a pessoa' : ' projeto'} para ver os detalhes.
        </p>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MONTH_CACHE_KEY = 'ts:cache:dash:month:v2';
const YEAR_CACHE_KEY  = 'ts:cache:dash:year:v2';

export default function DashboardHistorico({ people, year, week }) {
  const [periodo, setPeriodo] = useState('mes');   // 'mes' | 'ano'
  const [ccFilter, setCcFilter] = useState('');
  const [subTab, setSubTab] = useState('projetos');

  const [monthRows, setMonthRows] = useState(null);
  const [yearRows,  setYearRows]  = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingYear,  setLoadingYear]  = useState(false);
  const [yearProgress, setYearProgress] = useState(0);

  // Mês corrente baseado na semana selecionada
  const selDate = useMemo(() => {
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const d = new Date(jan4);
    d.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
    return d;
  }, [year, week]);

  const currentMonth = getMonth(selDate);
  const currentMonthYear = getYear(selDate);

  // Carrega mês na montagem (ou cache)
  const loadMonth = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(MONTH_CACHE_KEY), null);
    if (isCacheFresh(cached) && Array.isArray(cached.data)) {
      setMonthRows(cached.data); return;
    }
    setLoadingMonth(true);
    try {
      const weeks = weeksOfMonth(currentMonthYear, currentMonth);
      const results = await Promise.all(weeks.map(w => loadForWeek(w.year, w.week)));
      const rows = results.flat();
      setMonthRows(rows);
      localStorage.setItem(MONTH_CACHE_KEY, JSON.stringify({ data: rows, savedAt: Date.now() }));
    } catch (e) { console.error('[DashboardHistorico] loadMonth error:', e); }
    finally { setLoadingMonth(false); }
  }, [currentMonth, currentMonthYear]);

  const loadYear = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(YEAR_CACHE_KEY), null);
    if (isCacheFresh(cached, 30 * 60 * 1000) && Array.isArray(cached.data)) {
      setYearRows(cached.data); return;
    }
    setLoadingYear(true);
    setYearProgress(0);
    try {
      const rows = await loadLastYear(year, { onProgress: n => setYearProgress(n) });
      setYearRows(rows);
      localStorage.setItem(YEAR_CACHE_KEY, JSON.stringify({ data: rows, savedAt: Date.now() }));
    } catch (e) { console.error('[DashboardHistorico] loadYear error:', e); }
    finally { setLoadingYear(false); }
  }, [year]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const rawRows = periodo === 'mes' ? (monthRows || []) : (yearRows || []);

  // Filtro por CC
  const rows = useMemo(() =>
    ccFilter ? rawRows.filter(r => r.Business_Unit === ccFilter) : rawRows,
  [rawRows, ccFilter]);

  const allCcs = useMemo(() =>
    [...new Set(rawRows.map(r => r.Business_Unit).filter(Boolean))].sort(),
  [rawRows]);

  const isLoading = periodo === 'mes' ? loadingMonth : loadingYear;
  const needsLoad = periodo === 'ano' && yearRows === null && !loadingYear;

  return (
    <div className="px-4 py-4 pb-20 space-y-4">

      {/* Controles globais */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Toggle período */}
        <div className="flex gap-[2px] p-[3px] bg-[var(--surface-raised)] rounded-full border border-[var(--border)]">
          {[['mes', 'Mês'], ['ano', 'Ano']].map(([k, label]) => (
            <button key={k} onClick={() => setPeriodo(k)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                periodo === k ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Filtro CC */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCcFilter('')}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              !ccFilter ? 'bg-[var(--text-primary)] text-[var(--canvas)] border-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
            }`}>Todos</button>
          {allCcs.map(cc => (
            <button key={cc} onClick={() => setCcFilter(c => c === cc ? '' : cc)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                ccFilter === cc ? 'bg-[var(--text-primary)] text-[var(--canvas)] border-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ccColor(cc) }} />
              {cc}
            </button>
          ))}
        </div>

        {periodo === 'mes' && (
          <button onClick={loadMonth} disabled={loadingMonth}
            className="ml-auto text-xs text-[var(--accent)] hover:underline disabled:opacity-40">
            {loadingMonth ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        )}
      </div>

      {/* Estado: precisa carregar o ano */}
      {needsLoad && (
        <div className="flex flex-col items-center py-12 gap-3">
          <p className="text-sm text-[var(--text-secondary)]">Dados do ano não carregados ainda.</p>
          <button onClick={loadYear}
            className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">
            Carregar ano {year}
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="flex items-center gap-3 py-6">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-sm text-[var(--text-secondary)]">
            {periodo === 'ano' ? `Carregando ${yearProgress} registros…` : 'Carregando mês…'}
          </span>
        </div>
      )}

      {/* Conteúdo */}
      {!isLoading && !needsLoad && rows.length >= 0 && (
        <>
          {/* KPIs */}
          <KpiStrip rows={rows} />

          {/* Sub-abas */}
          <div className="flex gap-[2px] p-[3px] bg-[var(--surface-raised)] rounded-full w-fit border border-[var(--border)]">
            {[['projetos', 'Projetos'], ['individual', 'Individual']].map(([k, label]) => (
              <button key={k} onClick={() => setSubTab(k)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                  subTab === k ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {subTab === 'projetos'    && <ViewProjetos rows={rows} />}
          {subTab === 'individual'  && <ViewIndividual rows={rows} />}
        </>
      )}
    </div>
  );
}
