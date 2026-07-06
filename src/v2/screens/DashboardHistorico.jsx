import { useState, useEffect, useMemo, useCallback } from 'react';
import { getISOWeek, getMonth, getYear, format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadForWeek, loadLastYear } from '../../lib/clickup/entries.js';
import { ccColor } from '../../lib/clickup/fields.js';

// ── Utils ─────────────────────────────────────────────────────────────────────
function safeJsonParse(s, f) { try { return JSON.parse(s) ?? f; } catch { return f; } }
function isCacheFresh(c, ttl = 5 * 60 * 1000) { return c?.savedAt && (Date.now() - c.savedAt) < ttl; }

function weeksOfMonth(year, month) {
  const weeks = [], d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const w = getISOWeek(d);
    const wy = (w === 1 && d.getMonth() === 11) ? d.getFullYear() + 1
             : (w >= 52 && d.getMonth() === 0)  ? d.getFullYear() - 1 : d.getFullYear();
    const key = `${wy}-${w}`;
    if (!weeks.find(x => x.key === key)) weeks.push({ year: wy, week: w, key });
    d.setDate(d.getDate() + 1);
  }
  return weeks;
}

function mondayOfWeek(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const d = new Date(jan4);
  d.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  return d;
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ segments, total, centerLabel, centerSub }) {
  const shown = segments.filter(s => s.value > 0);
  let cum = 0;
  const stops = shown.map(s => {
    const pct = (s.value / total) * 100;
    const from = cum.toFixed(2); cum += pct;
    return `${s.color} ${from}% ${cum.toFixed(2)}%`;
  });
  const gradient = shown.length
    ? `conic-gradient(from -90deg, ${stops.join(', ')})`
    : `conic-gradient(var(--border) 0% 100%)`;
  return (
    <div className="relative flex-shrink-0" style={{ width: 148, height: 148 }}>
      <div style={{ width: 148, height: 148, borderRadius: '50%', background: gradient }} />
      <div className="absolute rounded-full bg-[var(--surface)] flex flex-col items-center justify-center" style={{ inset: '26%' }}>
        <span className="font-display tabular-nums text-[20px] font-semibold leading-none text-[var(--text-primary)]">{centerLabel}</span>
        <span className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)] mt-0.5">{centerSub}</span>
      </div>
    </div>
  );
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function KpiHero({ rows }) {
  const totalF = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const totalC = rows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
  const realizacao = totalF > 0 ? Math.round((totalC / totalF) * 100) : 0;
  const ccMap = new Map();
  for (const r of rows) {
    if (!r.Business_Unit) continue;
    ccMap.set(r.Business_Unit, (ccMap.get(r.Business_Unit) || 0) + (Number(r.Hours_Forecast) || 0));
  }
  const topCC = [...ccMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPct = topCC && totalF > 0 ? Math.round((topCC[1] / totalF) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-1">Total previsto</p>
        <div className="flex items-end gap-2">
          <span className="font-display text-[42px] leading-none tabular-nums text-[var(--text-primary)]">{totalF}</span>
          <span className="text-[var(--text-secondary)] mb-1.5 text-sm">horas</span>
        </div>
        {topCC && (
          <p className="text-xs text-[var(--text-secondary)] mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: ccColor(topCC[0]) }} />
            <span className="font-medium text-[var(--text-primary)]">{topPct}%</span> em {topCC[0]}
          </p>
        )}
      </div>
      <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 flex flex-col justify-between">
        <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Realização</p>
        <div>
          <span className="font-display text-[42px] leading-none tabular-nums"
            style={{ color: realizacao >= 80 ? 'var(--positive)' : realizacao >= 50 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {realizacao}
          </span>
          <span className="text-[var(--text-secondary)] text-sm ml-1">%</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{totalC}h realizadas</p>
      </div>
    </div>
  );
}

// ── CC Distribution ───────────────────────────────────────────────────────────
function CCDistribution({ rows }) {
  const [hovered, setHovered] = useState(null);
  const totalF = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const segments = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!r.Business_Unit) continue;
      map.set(r.Business_Unit, (map.get(r.Business_Unit) || 0) + (Number(r.Hours_Forecast) || 0));
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value, color: ccColor(name), pct: totalF > 0 ? Math.round((value / totalF) * 100) : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [rows, totalF]);
  if (!segments.length) return null;
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-4">Distribuição por centro de custo</p>
      <div className="flex items-center gap-6">
        <DonutChart segments={segments} total={totalF} centerLabel={totalF} centerSub="horas" />
        <div className="flex-1 space-y-2 min-w-0">
          {segments.map(s => (
            <div key={s.name}
              onMouseEnter={() => setHovered(s.name)}
              onMouseLeave={() => setHovered(null)}
              className={`flex items-center gap-2.5 transition-opacity ${hovered && hovered !== s.name ? 'opacity-40' : 'opacity-100'}`}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-sm text-[var(--text-primary)] truncate flex-1 min-w-0">{s.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="h-1.5 rounded-full bg-[var(--surface-raised)] w-16 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
                <span className="tabular-nums text-xs text-[var(--text-secondary)] w-8 text-right">{s.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────────
function ProjectPanel({ project, rows, onClose }) {
  const data = useMemo(() => {
    const filtered = rows.filter(r => r.Project === project);
    const byPerson = new Map();
    for (const r of filtered) {
      if (!r.Person) continue;
      const g = byPerson.get(r.Person) || { name: r.Person, f: 0, c: 0 };
      g.f += Number(r.Hours_Forecast) || 0;
      g.c += Number(r.Hours_Consolidated) || 0;
      byPerson.set(r.Person, g);
    }
    const people = [...byPerson.values()].sort((a, b) => b.f - a.f);
    const totalF = people.reduce((s, p) => s + p.f, 0);
    const totalC = people.reduce((s, p) => s + p.c, 0);
    const cc = filtered[0]?.Business_Unit ?? '';
    return { people, totalF, totalC, cc };
  }, [project, rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-[20px] bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-start gap-3">
          <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: ccColor(data.cc) }} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[var(--text-primary)] leading-tight">{project}</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{data.cc}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none mt-0.5">×</button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
          {[
            { label: 'Horas previstas', value: `${data.totalF}h` },
            { label: 'Horas realizadas', value: `${data.totalC}h` },
          ].map(k => (
            <div key={k.label} className="bg-[var(--surface)] px-5 py-3 text-center">
              <div className="font-display tabular-nums text-[28px] leading-none text-[var(--text-primary)]">{k.value}</div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Pessoas */}
        <div className="px-5 py-3">
          <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            {data.people.length} pessoa{data.people.length !== 1 ? 's' : ''} alocada{data.people.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {data.people.map(p => {
              const pct = data.totalF > 0 ? Math.round((p.f / data.totalF) * 100) : 0;
              const desvio = p.c - p.f;
              return (
                <div key={p.name}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm flex-1 text-[var(--text-primary)]">{p.name}</span>
                    <span className="tabular-nums text-xs text-[var(--text-secondary)]">{p.f}h prev</span>
                    {p.c > 0 && (
                      <span className={`tabular-nums text-xs font-medium ${desvio < 0 ? 'text-[var(--negative-text)]' : desvio > 0 ? 'text-[var(--positive-text)]' : 'text-[var(--positive-text)]'}`}>
                        {p.c}h real
                      </span>
                    )}
                  </div>
                  <div className="h-1 rounded-full bg-[var(--surface-raised)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: ccColor(data.cc) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Bars (clickable) ──────────────────────────────────────────────────
function ProjectBars({ rows, onSelect }) {
  const byProject = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!r.Project) continue;
      const g = map.get(r.Project) || { name: r.Project, cc: r.Business_Unit, f: 0, c: 0, people: new Set() };
      g.f += Number(r.Hours_Forecast) || 0;
      g.c += Number(r.Hours_Consolidated) || 0;
      if (r.Person) g.people.add(r.Person);
      map.set(r.Project, g);
    }
    return [...map.values()].filter(g => g.f > 0).sort((a, b) => b.f - a.f).slice(0, 12)
      .map(g => ({ ...g, people: [...g.people] }));
  }, [rows]);
  if (!byProject.length) return null;
  const max = byProject[0]?.f || 1;
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-4">Projetos — clique para detalhar</p>
      <div className="space-y-3">
        {byProject.map(p => (
          <button key={p.name} onClick={() => onSelect(p.name)}
            className="w-full text-left group hover:bg-[var(--surface-raised)] -mx-2 px-2 py-1 rounded-lg transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ccColor(p.cc) }} />
              <span className="text-sm text-[var(--text-primary)] flex-1 truncate group-hover:text-[var(--accent)] transition-colors">{p.name}</span>
              <span className="tabular-nums text-xs text-[var(--text-secondary)] flex-shrink-0">
                {p.people.slice(0, 2).join(', ')}{p.people.length > 2 ? ` +${p.people.length - 2}` : ''}
              </span>
              <span className="tabular-nums text-sm font-medium text-[var(--text-primary)] w-10 text-right flex-shrink-0">{p.f}h</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(p.f / max) * 100}%`, background: ccColor(p.cc), opacity: p.c > 0 ? 1 : 0.6 }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── People View ───────────────────────────────────────────────────────────────
function PeopleView({ rows, people }) {
  const byPerson = useMemo(() => {
    const map = new Map();
    for (const p of people) map.set(p.name, { name: p.name, unidade: p.unidade, f: 0, c: 0, projects: new Map() });
    for (const r of rows) {
      if (!r.Person) continue;
      const g = map.get(r.Person) || { name: r.Person, unidade: null, f: 0, c: 0, projects: new Map() };
      g.f += Number(r.Hours_Forecast) || 0;
      g.c += Number(r.Hours_Consolidated) || 0;
      if (r.Project) {
        const proj = g.projects.get(r.Project) || { name: r.Project, cc: r.Business_Unit, f: 0, c: 0 };
        proj.f += Number(r.Hours_Forecast) || 0;
        proj.c += Number(r.Hours_Consolidated) || 0;
        g.projects.set(r.Project, proj);
      }
      map.set(r.Person, g);
    }
    return [...map.values()]
      .map(g => ({ ...g, projects: [...g.projects.values()].sort((a, b) => b.f - a.f) }))
      .sort((a, b) => b.f - a.f);
  }, [rows, people]);

  const [expanded, setExpanded] = useState(null);

  if (!byPerson.length) return <p className="py-6 text-center text-sm text-[var(--text-secondary)]">Sem dados.</p>;

  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-4">Pessoas</p>
      <div className="space-y-1">
        {byPerson.map(p => {
          const realizacao = p.f > 0 ? Math.round((p.c / p.f) * 100) : 0;
          const statusColor = !p.f ? 'var(--border)' : p.c >= p.f ? 'var(--positive)' : p.c > 0 ? 'var(--warning)' : 'var(--accent)';
          const isOpen = expanded === p.name;
          return (
            <div key={p.name} className="rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(e => e === p.name ? null : p.name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-raised)] transition-colors text-left rounded-xl"
              >
                <span className="text-[var(--text-secondary)] text-xs w-3">{isOpen ? '▼' : '▶'}</span>
                <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</span>
                {p.unidade && (
                  <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">{p.unidade}</span>
                )}
                {/* Mini progress bar */}
                <div className="w-16 h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden flex-shrink-0">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (p.f / 40) * 100)}%`, background: statusColor }} />
                </div>
                <span className="tabular-nums text-sm text-[var(--text-primary)] w-12 text-right flex-shrink-0">
                  {p.f}h
                </span>
                {p.c > 0 && (
                  <span className={`tabular-nums text-xs flex-shrink-0 ${realizacao >= 100 ? 'text-[var(--positive-text)]' : 'text-[var(--warning-text)]'}`}>
                    {realizacao}%
                  </span>
                )}
              </button>
              {isOpen && p.projects.length > 0 && (
                <div className="ml-6 mr-3 mb-2 space-y-1 border-l border-[var(--border-subtle)] pl-3">
                  {p.projects.map(proj => (
                    <div key={proj.name} className="flex items-center gap-2 py-1 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ccColor(proj.cc) }} />
                      <span className="flex-1 text-[var(--text-secondary)] truncate">{proj.name}</span>
                      <span className="tabular-nums text-[var(--text-primary)]">{proj.f}h</span>
                      {proj.c > 0 && <span className="tabular-nums text-[var(--positive-text)]">· {proj.c}h real</span>}
                    </div>
                  ))}
                </div>
              )}
              {isOpen && p.projects.length === 0 && (
                <p className="ml-6 mb-2 text-xs text-[var(--text-secondary)]">Sem alocações no período.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MONTH_KEY_PREFIX = 'ts:cache:dash:month:v2';
const YEAR_KEY  = 'ts:cache:dash:year:v2';

export default function DashboardHistorico({ people, year, week }) {
  const [periodo, setPeriodo] = useState('mes');
  const [monthRows, setMonthRows] = useState(null);
  const [yearRows,  setYearRows]  = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingYear,  setLoadingYear]  = useState(false);
  const [yearProgress, setYearProgress] = useState(0);
  const [selectedProject, setSelectedProject] = useState(null);

  // Navegação mensal própria do Dashboard, independente da semana global (WeekNav).
  const initialDate = useMemo(() => mondayOfWeek(year, week), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [viewDate, setViewDate] = useState(initialDate);
  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: ptBR });
  const currentMonth = getMonth(viewDate);
  const currentMonthYear = getYear(viewDate);
  const monthKey = `${MONTH_KEY_PREFIX}:${currentMonthYear}-${currentMonth}`;

  function prevMonth() { setViewDate(d => subMonths(d, 1)); }
  function nextMonth() { setViewDate(d => addMonths(d, 1)); }

  const loadMonth = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(monthKey), null);
    if (isCacheFresh(cached) && Array.isArray(cached.data)) { setMonthRows(cached.data); return; }
    setLoadingMonth(true);
    setMonthRows(null);
    try {
      const wks = weeksOfMonth(currentMonthYear, currentMonth);
      const results = await Promise.all(wks.map(w => loadForWeek(w.year, w.week)));
      const rows = results.flat();
      setMonthRows(rows);
      localStorage.setItem(monthKey, JSON.stringify({ data: rows, savedAt: Date.now() }));
    } catch (e) { console.error(e); } finally { setLoadingMonth(false); }
  }, [currentMonth, currentMonthYear, monthKey]);

  const loadYear = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(YEAR_KEY), null);
    if (isCacheFresh(cached, 30 * 60 * 1000) && Array.isArray(cached.data)) { setYearRows(cached.data); return; }
    setLoadingYear(true); setYearProgress(0);
    try {
      const rows = await loadLastYear(year, { onProgress: n => setYearProgress(n) });
      setYearRows(rows);
      localStorage.setItem(YEAR_KEY, JSON.stringify({ data: rows, savedAt: Date.now() }));
    } catch (e) { console.error(e); } finally { setLoadingYear(false); }
  }, [year]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const allRows = periodo === 'mes' ? (monthRows || []) : (yearRows || []);

  // Filtra por unidade (via people prop já filtrado pelo UnidadeFilter do AppV2)
  const rows = useMemo(() => {
    if (!people.length) return allRows;
    const names = new Set(people.map(p => p.name));
    return allRows.filter(r => !r.Person || names.has(r.Person));
  }, [allRows, people]);

  const isLoading = periodo === 'mes' ? loadingMonth : loadingYear;
  const needsLoad = periodo === 'ano' && yearRows === null && !loadingYear;

  return (
    <div className="px-4 py-4 pb-24 space-y-3">
      {/* Toggle período */}
      <div className="flex items-center gap-3">
        {periodo === 'mes' && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={prevMonth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors"
              aria-label="Mês anterior"
            >‹</button>
            <button
              onClick={nextMonth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors"
              aria-label="Próximo mês"
            >›</button>
          </div>
        )}
        <div className="flex gap-[2px] p-[3px] bg-[var(--surface-raised)] rounded-full border border-[var(--border)]">
          <button onClick={() => setPeriodo('mes')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all capitalize ${periodo === 'mes' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}>
            {monthLabel}
          </button>
          <button onClick={() => { setPeriodo('ano'); if (!yearRows && !loadingYear) loadYear(); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${periodo === 'ano' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}>
            {year}
          </button>
        </div>
        {periodo === 'mes' && !loadingMonth && (
          <button onClick={loadMonth} className="text-xs text-[var(--accent)] hover:underline ml-auto">↻ Atualizar</button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 py-10 justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-sm text-[var(--text-secondary)]">
            {periodo === 'ano' ? `${yearProgress} registros…` : 'Carregando mês…'}
          </span>
        </div>
      )}

      {/* Lazy load do ano */}
      {needsLoad && (
        <div className="flex flex-col items-center py-12 gap-3">
          <p className="text-sm text-[var(--text-secondary)]">Dados de {year} não carregados.</p>
          <button onClick={loadYear}
            className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90">
            Carregar {year}
          </button>
        </div>
      )}

      {/* Conteúdo */}
      {!isLoading && !needsLoad && (
        <>
          <KpiHero rows={rows} />
          <CCDistribution rows={rows} />
          <ProjectBars rows={rows} onSelect={setSelectedProject} />
          <PeopleView rows={rows} people={people} />
        </>
      )}

      {/* Project detail panel */}
      {selectedProject && (
        <ProjectPanel
          project={selectedProject}
          rows={allRows}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
