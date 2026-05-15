import React, { useMemo, useState } from "react";

const card  = "bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)]";
const th    = "px-3 py-2 text-left text-[10.5px] font-semibold text-[var(--text-3)] uppercase tracking-[0.06em] whitespace-nowrap";
const td    = "px-3 py-2 text-[14px]";

function DesvioCell({ d }) {
  if (d == null) return <span className="text-[var(--text-3)]">—</span>;
  if (d === 0)   return <span className="text-[var(--positive)] font-semibold tabular-nums">0h</span>;
  if (d > 0)     return <span className="text-[var(--negative)] font-semibold tabular-nums">+{d}h</span>;
  return               <span className="text-[var(--warning)] font-semibold tabular-nums">{d}h</span>;
}

function BarChart({ title, data }) {
  const max = useMemo(() => Math.max(1, ...data.map(d => Math.max(d.forecast || 0, d.consolidated || 0))), [data]);
  return (
    <div className={card}>
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="font-semibold text-[14px]">{title}</h3>
      </div>
      {!data.length ? (
        <div className="px-4 py-8 text-[14px] text-[var(--text-3)] text-center">Sem dados.</div>
      ) : (
        <div className="p-4 space-y-3">
          {data.map(d => (
            <div key={d.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[14px] truncate max-w-[180px]" title={d.name}>{d.name}</span>
                <div className="flex gap-3 text-[12px] tabular-nums text-[var(--text-3)]">
                  {d.consolidated != null && (
                    <span className="text-[var(--text-1)] font-semibold">{d.consolidated}h real</span>
                  )}
                  <span>{d.forecast}h prev</span>
                </div>
              </div>
              <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-[var(--surface-alt)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.round((d.forecast / max) * 100)}%`, minWidth: d.forecast > 0 ? 2 : 0 }}
                />
                {d.consolidated != null && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round((d.consolidated / max) * 100)}%`,
                      minWidth: d.consolidated > 0 ? 2 : 0,
                      backgroundColor: d.consolidated > d.forecast ? 'var(--negative)' : 'var(--positive)',
                      opacity: 0.85,
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-4 pt-1 text-[11px] text-[var(--text-3)]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-[var(--accent)] inline-block" />Previsto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--positive)', opacity: 0.85 }} />Realizado
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vertical Bar Chart (gráfico de barras vertical) ────────────────────────
// Cores no estilo Apple/iOS (consistente com o app)
const PALETTE = [
  '#7B68EE', '#3B82F6', '#10B981', '#F59E0B', '#EC4899',
  '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
  '#A855F7', '#0EA5E9', '#22C55E', '#EAB308', '#EF4444',
  '#6366F1', '#0284C7', '#65A30D', '#D97706', '#DC2626',
];

function VerticalBars({ title, badge, data, formatValue = v => v.toLocaleString('pt-BR') + 'h', maxItems = 20 }) {
  const shown = data.slice(0, maxItems);
  const max = useMemo(() => Math.max(1, ...shown.map(d => Math.abs(d.value))), [shown]);

  return (
    <div className={card}>
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold text-[15px]">{title}</h3>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] uppercase tracking-wider">
              {badge}
            </span>
          )}
        </div>
        {data.length > maxItems && (
          <span className="text-[11px] text-[var(--text-3)]">top {maxItems} de {data.length}</span>
        )}
      </div>
      {!shown.length ? (
        <div className="px-5 py-10 text-[15px] text-[var(--text-3)] text-center">Sem dados.</div>
      ) : (
        <div className="px-5 pt-5 pb-3 overflow-x-auto">
          <div className="flex items-end gap-3 min-h-[280px] pb-20" style={{ minWidth: Math.max(shown.length * 64, 400) }}>
            {shown.map((d, i) => {
              const h = Math.max(3, Math.round((Math.abs(d.value) / max) * 240));
              const color = d.color || PALETTE[i % PALETTE.length];
              return (
                <div key={d.name} className="flex flex-col items-center flex-1 min-w-[42px] relative">
                  <span className="text-[11px] tabular-nums text-[var(--text-3)] mb-1.5">{formatValue(d.value)}</span>
                  <div
                    className="w-full rounded-t-[6px] transition-opacity hover:opacity-80"
                    style={{ height: h, backgroundColor: color }}
                    title={`${d.name}: ${formatValue(d.value)}`}
                  />
                  <div className="absolute top-full mt-2 left-1/2 origin-top-left -translate-x-1/2 -rotate-[35deg]">
                    <span className="text-[11px] text-[var(--text-2)] whitespace-nowrap block" title={d.name}>
                      {d.name.length > 28 ? d.name.slice(0, 27) + '…' : d.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Weekly aggregate bars (horas por semana, simples) ──────────────────────
function WeeklyBars({ rows, mode = 'forecast' }) {
  const { weeks, max } = useMemo(() => {
    const byWeek = new Map();
    for (const r of rows || []) {
      const w = r.ISO_Week;
      if (!w) continue;
      const v = mode === 'forecast' ? Number(r.Hours_Forecast) || 0
              : mode === 'consolidated' ? Number(r.Hours_Consolidated) || 0
              : (Number(r.Hours_Consolidated) || 0) - (Number(r.Hours_Forecast) || 0);
      byWeek.set(w, (byWeek.get(w) || 0) + v);
    }
    const weeks = Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0])
      .map(([w, v]) => ({ w, v }));
    const max = Math.max(1, ...weeks.map(x => Math.abs(x.v)));
    return { weeks, max };
  }, [rows, mode]);

  if (!weeks.length) return null;
  const accent = mode === 'desvio' ? 'var(--negative)' : 'var(--accent)';
  return (
    <div className={card}>
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="font-semibold text-[15px]">Horas por Semana</h3>
        <span className="text-[11px] text-[var(--text-3)] uppercase tracking-wider">
          {mode === 'forecast' ? 'previsto' : mode === 'consolidated' ? 'realizado' : 'desvio'}
        </span>
      </div>
      <div className="px-5 pt-4 pb-3 overflow-x-auto">
        <div className="flex items-end gap-2 min-h-[120px]" style={{ minWidth: weeks.length * 36 }}>
          {weeks.map(({ w, v }) => {
            const h = Math.max(2, Math.round((Math.abs(v) / max) * 110));
            const color = mode === 'desvio' ? (v > 0 ? 'var(--negative)' : v < 0 ? 'var(--warning)' : 'var(--text-3)') : accent;
            return (
              <div key={w} className="flex flex-col items-center gap-1.5 flex-1" title={`W${String(w).padStart(2,'0')}: ${v}h`}>
                <span className="text-[11px] tabular-nums text-[var(--text-3)]">{v || ''}</span>
                <div className="w-full rounded-t" style={{ height: h, backgroundColor: color, opacity: 0.85 }} />
                <span className="text-[11px] tabular-nums text-[var(--text-3)]">W{String(w).padStart(2,'0')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Heatmap Projeto × Semana (matriz com intensidade de cor) ────────────────
function Heatmap({ rows, mode = 'forecast', sort = 'total' }) {
  const { projects, weeks, pivot, max, projTotals, weekTotals, total } = useMemo(() => {
    const projectsSet = new Set();
    const weeksSet = new Set();
    const pivot = {};
    for (const r of rows || []) {
      const p = r.Project || '—';
      const w = r.ISO_Week;
      if (!w) continue;
      const fc = Number(r.Hours_Forecast) || 0;
      const co = Number(r.Hours_Consolidated) || 0;
      const v = mode === 'forecast' ? fc : mode === 'consolidated' ? co : (co - fc);
      if (v === 0 && mode !== 'desvio') continue;
      projectsSet.add(p);
      weeksSet.add(w);
      pivot[p] ??= {};
      pivot[p][w] = (pivot[p][w] || 0) + v;
    }
    const weeks = Array.from(weeksSet).sort((a, b) => a - b);

    const projTotals = {};
    for (const [p, byW] of Object.entries(pivot)) {
      projTotals[p] = Object.values(byW).reduce((s, v) => s + v, 0);
    }

    let projects = Array.from(projectsSet);
    if (sort === 'total') {
      projects.sort((a, b) => Math.abs(projTotals[b]) - Math.abs(projTotals[a]));
    } else if (sort === 'name') {
      projects.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    } else if (sort === 'recente') {
      const lastWeek = weeks[weeks.length - 1];
      projects.sort((a, b) => (pivot[b]?.[lastWeek] || 0) - (pivot[a]?.[lastWeek] || 0));
    }

    const weekTotals = {};
    for (const w of weeks) {
      weekTotals[w] = projects.reduce((s, p) => s + (pivot[p]?.[w] || 0), 0);
    }

    const allValues = Object.values(pivot).flatMap(byW => Object.values(byW).map(Math.abs));
    const max = allValues.length ? Math.max(...allValues) : 1;
    const total = projects.reduce((s, p) => s + projTotals[p], 0);
    return { projects, weeks, pivot, max, projTotals, weekTotals, total };
  }, [rows, mode, sort]);

  function cellStyle(v) {
    if (!v) return {};
    const intensity = Math.min(1, Math.abs(v) / max);
    if (mode === 'desvio') {
      const color = v > 0 ? '255, 59, 48' : '255, 149, 0';
      return { backgroundColor: `rgba(${color}, ${0.1 + intensity * 0.55})` };
    }
    return { backgroundColor: `rgba(0, 122, 255, ${0.06 + intensity * 0.5})` };
  }

  function cellColorForFooter(v) {
    if (!v) return undefined;
    if (mode === 'desvio') return v > 0 ? 'var(--negative)' : 'var(--warning)';
    return 'var(--accent)';
  }

  if (!projects.length) {
    return <div className="px-5 py-10 text-[15px] text-[var(--text-3)] text-center">Sem dados para o filtro atual.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-[12.5px] border-collapse" style={{ minWidth: 200 + weeks.length * 56 }}>
        <thead>
          <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-subtle)]">
            <th className="sticky left-0 z-10 bg-[var(--surface-alt)] px-3 py-2.5 text-left text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide w-[220px]">
              Projeto
            </th>
            {weeks.map(w => (
              <th key={w} className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide tabular-nums">
                W{String(w).padStart(2, '0')}
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-[var(--surface-alt)] px-3 py-2.5 text-right text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {projects.map(p => (
            <tr key={p} className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
              <td className="sticky left-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--surface-alt)] px-3 py-2 text-[13.5px] truncate max-w-[220px]" title={p}>
                {p}
              </td>
              {weeks.map(w => {
                const v = pivot[p]?.[w] || 0;
                return (
                  <td key={w} className="text-center tabular-nums px-1 py-2" style={cellStyle(v)} title={v ? `W${String(w).padStart(2,'0')} · ${p}: ${v}h` : undefined}>
                    {v ? (mode === 'desvio' && v > 0 ? `+${v}` : v) : ''}
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--surface-alt)] px-3 py-2 text-right font-semibold tabular-nums">
                {projTotals[p]}h
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-alt)]">
            <td className="sticky left-0 bg-[var(--surface-alt)] px-3 py-2.5 text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">
              Total/semana
            </td>
            {weeks.map(w => (
              <td key={w} className="text-center tabular-nums px-1 py-2.5 font-semibold" style={{ color: cellColorForFooter(weekTotals[w]) }}>
                {weekTotals[w] || ''}
              </td>
            ))}
            <td className="sticky right-0 bg-[var(--surface-alt)] px-3 py-2.5 text-right font-bold tabular-nums">
              {total}h
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function groupBy(rows, key) {
  const map = new Map();
  for (const r of rows || []) {
    const g   = r[key] || "—";
    const agg = map.get(g) || { name: g, forecast: 0, consolidated: 0, hasConsolidated: false, count: 0 };
    agg.forecast += Number(r.Hours_Forecast) || 0;
    if (r.Hours_Consolidated != null) { agg.consolidated += Number(r.Hours_Consolidated) || 0; agg.hasConsolidated = true; }
    agg.count++;
    map.set(g, agg);
  }
  return Array.from(map.values())
    .map(x => ({ ...x, consolidated: x.hasConsolidated ? x.consolidated : null }))
    .sort((a, b) => b.forecast - a.forecast);
}

export default function Dashboard({ db, projectMeta = {} }) {
  const [unitFilter,    setUnitFilter]    = useState("");
  const [personFilter,  setPersonFilter]  = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [weekFilter,    setWeekFilter]    = useState("");
  // Heatmap state: modo (previsto/realizado/desvio) e ordenação
  const [hmMode, setHmMode] = useState('forecast');
  const [hmSort, setHmSort] = useState('total');
  // Toggle: incluir projetos internos (Gestão, Comercial etc.) nos rankings
  const [includeInternos, setIncludeInternos] = useState(false);

  // Listas das opções dependem do filtro corrente — cada select mostra só o que faz sentido
  // dado os outros filtros. Pessoa filtrada por Unidade etc.
  const allUnits = useMemo(() => {
    const rows = (db || []).filter(r =>
      (!personFilter  || r.Person === personFilter) &&
      (!projectFilter || r.Project === projectFilter) &&
      (!weekFilter    || String(r.ISO_Week) === weekFilter)
    );
    return [...new Set(rows.map(r => r.Business_Unit).filter(Boolean))].sort();
  }, [db, personFilter, projectFilter, weekFilter]);

  const allPeople = useMemo(() => {
    const rows = (db || []).filter(r =>
      (!unitFilter    || r.Business_Unit === unitFilter) &&
      (!projectFilter || r.Project === projectFilter) &&
      (!weekFilter    || String(r.ISO_Week) === weekFilter)
    );
    return [...new Set(rows.map(r => r.Person).filter(Boolean))].sort();
  }, [db, unitFilter, projectFilter, weekFilter]);

  const allProjects = useMemo(() => {
    const rows = (db || []).filter(r =>
      (!unitFilter   || r.Business_Unit === unitFilter) &&
      (!personFilter || r.Person === personFilter) &&
      (!weekFilter   || String(r.ISO_Week) === weekFilter)
    );
    return [...new Set(rows.map(r => r.Project).filter(Boolean))].sort();
  }, [db, unitFilter, personFilter, weekFilter]);

  const allWeeks = useMemo(() => {
    const rows = (db || []).filter(r =>
      (!unitFilter    || r.Business_Unit === unitFilter) &&
      (!personFilter  || r.Person === personFilter) &&
      (!projectFilter || r.Project === projectFilter)
    );
    return [...new Set(rows.map(r => r.ISO_Week).filter(Boolean))].sort((a, b) => a - b);
  }, [db, unitFilter, personFilter, projectFilter]);

  const filtered = useMemo(() => {
    let rows = db || [];
    if (unitFilter)    rows = rows.filter(r => r.Business_Unit === unitFilter);
    if (personFilter)  rows = rows.filter(r => r.Person === personFilter);
    if (projectFilter) rows = rows.filter(r => r.Project === projectFilter);
    if (weekFilter)    rows = rows.filter(r => String(r.ISO_Week) === weekFilter);
    return rows;
  }, [db, unitFilter, personFilter, projectFilter, weekFilter]);

  const byPerson  = useMemo(() => groupBy(filtered, "Person"),        [filtered]);
  const byCC      = useMemo(() => groupBy(filtered, "Business_Unit"), [filtered]);

  // Heuristic + projectMeta para detectar projetos internos
  function isInternoProject(name) {
    if (!name) return false;
    const meta = projectMeta[name];
    if (meta?.isInterno) return true;
    // Heurísticas de fallback se o projeto não está em projectMeta
    return /^(Gestão|Comercial|Branding Sal|TI|G&C|Academia|Autorais|\[FÉRIAS\])/i.test(name);
  }

  // Agregado realizado por projeto (excl internos por padrão)
  const realizadasPorProjeto = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const p = r.Project;
      const co = Number(r.Hours_Consolidated) || 0;
      if (!p || co <= 0) continue;
      if (!includeInternos && isInternoProject(p)) continue;
      map.set(p, (map.get(p) || 0) + co);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, includeInternos, projectMeta]);

  // Agregado por Centro de Custo (realizado)
  const realizadasPorCC = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const cc = r.Business_Unit;
      const co = Number(r.Hours_Consolidated) || 0;
      if (!cc || co <= 0) continue;
      map.set(cc, (map.get(cc) || 0) + co);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Agregado por Cliente (lê da tabela LISTA_PROJETOS via projectMeta)
  const realizadasPorCliente = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const p = r.Project;
      const co = Number(r.Hours_Consolidated) || 0;
      if (!p || co <= 0) continue;
      const cliente = projectMeta[p]?.cliente || '— sem cliente cadastrado —';
      map.set(cliente, (map.get(cliente) || 0) + co);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, projectMeta]);

  // Contagens "no período"
  const projetosAtivos = useMemo(() => {
    const s = new Set();
    for (const r of filtered) {
      if (r.Project && ((Number(r.Hours_Forecast) || 0) > 0 || (Number(r.Hours_Consolidated) || 0) > 0)) {
        s.add(r.Project);
      }
    }
    return s.size;
  }, [filtered]);

  const pessoasAlocadas = useMemo(() => {
    const s = new Set();
    for (const r of filtered) {
      if (r.Person && ((Number(r.Hours_Forecast) || 0) > 0 || (Number(r.Hours_Consolidated) || 0) > 0)) {
        s.add(r.Person);
      }
    }
    return s.size;
  }, [filtered]);

  const openWeeks = useMemo(() => {
    const map = new Map();
    for (const r of db || []) {
      const key = `${r.Year}-W${String(r.ISO_Week).padStart(2, "0")}|${r.Person}`;
      const cur = map.get(key) || { key, year: r.Year, week: r.ISO_Week, person: r.Person, hasForecast: false, hasConsolidated: false };
      if (r.Hours_Forecast) cur.hasForecast = true;
      if (r.Hours_Consolidated != null) cur.hasConsolidated = true;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .filter(x => x.hasForecast && !x.hasConsolidated)
      .sort((a, b) => b.year - a.year || b.week - a.week);
  }, [db]);

  const totalForecast     = useMemo(() => filtered.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0), [filtered]);
  const totalConsolidated = useMemo(() => filtered.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0), [filtered]);
  const hasData = db && db.length > 0;

  const selectCls = "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-[14px] text-[var(--text-1)] focus:outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-colors";

  return (
    <div className="space-y-5">

      {/* Filters */}
      <div className={`${card} p-4`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_1fr_auto] items-end">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Centro de Custo</label>
            <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Pessoa</label>
            <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} className={selectCls}>
              <option value="">Todas</option>
              {allPeople.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Projeto</label>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {allProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Semana</label>
            <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} className={selectCls}>
              <option value="">Todas</option>
              {allWeeks.map(w => <option key={w} value={String(w)}>Semana {String(w).padStart(2, "0")}</option>)}
            </select>
          </div>
          <div>
            {(unitFilter || personFilter || projectFilter || weekFilter) ? (
              <button
                onClick={() => { setUnitFilter(""); setPersonFilter(""); setProjectFilter(""); setWeekFilter(""); }}
                className="px-4 py-2 rounded-[10px] bg-[var(--surface-alt)] text-[var(--accent)] text-[15px] font-medium hover:bg-[var(--surface-alt)] transition-colors w-full sm:w-auto">
                ↺ Limpar
              </button>
            ) : (
              <span className="hidden lg:inline-block text-[12px] text-[var(--text-3)] px-2">
                {filtered.length} de {(db || []).length} registros
              </span>
            )}
          </div>
        </div>
        {(unitFilter || personFilter || projectFilter || weekFilter) && (
          <div className="mt-2 text-[12px] text-[var(--text-3)]">
            {filtered.length} de {(db || []).length} registros após filtros
          </div>
        )}
      </div>

      {!hasData && (
        <div className="py-16 text-center text-[15px] text-[var(--text-3)]">
          Use "Carregar Semana" ou "Carregar Ano" para ver os dados.
        </div>
      )}

      {hasData && (
        <>
          {/* KPIs principais — no Período */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Horas Previstas no Período',
                value: totalForecast.toLocaleString('pt-BR') + 'h',
                color: 'text-[var(--accent)]',
                accent: 'var(--accent)',
              },
              {
                label: 'Horas Realizadas no Período',
                value: totalConsolidated > 0 ? totalConsolidated.toLocaleString('pt-BR') + 'h' : '—',
                color: 'text-[var(--positive)]',
                accent: 'var(--positive)',
              },
              {
                label: 'Projetos Ativos no Período',
                value: projetosAtivos.toString(),
                color: 'text-[var(--warning)]',
                accent: 'var(--warning)',
              },
              {
                label: 'Pessoas Alocadas no Período',
                value: pessoasAlocadas.toString(),
                color: 'text-[var(--accent)]',
                accent: 'var(--accent)',
              },
            ].map(k => (
              <div key={k.label} className={`${card} relative px-5 py-4 overflow-hidden`}>
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: k.accent }} />
                <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">{k.label}</div>
                <div className={`text-[32px] font-semibold tabular-nums leading-none ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Horas Realizadas por Projeto (vertical, excl internos opcional) */}
          <div>
            <div className="flex items-center justify-end mb-2 px-1">
              <label className="text-[12px] text-[var(--text-3)] inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInternos}
                  onChange={e => setIncludeInternos(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                incluir projetos internos
              </label>
            </div>
            <VerticalBars
              title="Horas Realizadas por Projeto"
              badge="realizado"
              data={realizadasPorProjeto}
              maxItems={20}
            />
          </div>

          {/* Horas por Centro de Custo */}
          <VerticalBars
            title="Horas Realizadas por Centro de Custo"
            badge="realizado"
            data={realizadasPorCC}
            maxItems={20}
          />

          {/* Horas por Cliente — lido da LISTA_PROJETOS */}
          <VerticalBars
            title="Horas Realizadas por Cliente"
            badge="realizado"
            data={realizadasPorCliente}
            maxItems={20}
          />

          {/* Detalhamento Projeto × Semana (mantido como visão avançada) */}
          <div className={card}>
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-semibold text-[15px]">Detalhamento Projeto × Semana</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex bg-[var(--surface-alt)] rounded-md p-0.5 gap-0.5 border border-[var(--border-subtle)]">
                  {[
                    { k: 'forecast',     label: 'Previsto' },
                    { k: 'consolidated', label: 'Realizado' },
                    { k: 'desvio',       label: 'Desvio' },
                  ].map(o => (
                    <button key={o.k} onClick={() => setHmMode(o.k)}
                      className={`px-3 py-1 rounded-[7px] text-[12px] font-medium transition-all ${
                        hmMode === o.k ? 'bg-[var(--surface)] text-[var(--text-1)] shadow-sm' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <select value={hmSort} onChange={e => setHmSort(e.target.value)} className="text-[12px] rounded-[9px] border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface-alt)] px-2 py-1">
                  <option value="total">Sort: Total</option>
                  <option value="recente">Sort: Semana recente</option>
                  <option value="name">Sort: Nome</option>
                </select>
              </div>
            </div>
            <Heatmap rows={filtered} mode={hmMode} sort={hmSort} />
          </div>

          {/* Por Pessoa (mantido — útil pra carga individual) */}
          <BarChart title="Horas por Pessoa" data={byPerson} />

          {/* Comparativo previsão vs real */}
          {byPerson.some(p => p.consolidated != null) && (
            <div className={card}>
              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-semibold text-[15px]">Comparativo por Pessoa</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]/40">
                      <th className={th}>Pessoa</th>
                      <th className={`${th} text-right`}>Previstas</th>
                      <th className={`${th} text-right`}>Realizadas</th>
                      <th className={`${th} text-right`}>Desvio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {byPerson.map(p => (
                      <tr key={p.name} className="hover:bg-[var(--surface-alt)] transition-colors">
                        <td className={`${td} font-medium`}>{p.name}</td>
                        <td className={`${td} text-right tabular-nums`}>{p.forecast}h</td>
                        <td className={`${td} text-right tabular-nums`}>{p.consolidated != null ? `${p.consolidated}h` : "—"}</td>
                        <td className={`${td} text-right`}>
                          <DesvioCell d={p.consolidated != null ? p.consolidated - p.forecast : null} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Semanas sem consolidado */}
          {openWeeks.length > 0 && (
            <div className={card}>
              <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <h3 className="font-semibold text-[15px]">Semanas sem Consolidado</h3>
                <span className="text-[12.5px] font-semibold px-2.5 py-1 rounded-md bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                  {openWeeks.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]/40">
                      <th className={th}>Semana</th>
                      <th className={th}>Ano</th>
                      <th className={th}>Pessoa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {openWeeks.map(x => (
                      <tr key={x.key} className="hover:bg-[var(--surface-alt)] transition-colors">
                        <td className={`${td} tabular-nums font-medium`}>W{String(x.week).padStart(2, "0")}</td>
                        <td className={`${td} tabular-nums text-[var(--text-3)]`}>{x.year}</td>
                        <td className={`${td} font-medium`}>{x.person}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
