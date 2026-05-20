import React, { useMemo, useState } from "react";

const card  = "bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)]";
const th    = "px-3 py-2 text-left text-[10.5px] font-semibold text-[var(--text-3)] uppercase tracking-[0.06em] whitespace-nowrap";
const td    = "px-3 py-2 text-[14px]";

// ─── DesvioCell ──────────────────────────────────────────────────────────────
function DesvioCell({ d }) {
  if (d == null) return <span className="text-[var(--text-3)]">—</span>;
  if (d === 0)   return <span className="text-[var(--positive)] font-semibold tabular-nums">0h</span>;
  if (d > 0)     return <span className="text-[var(--negative)] font-semibold tabular-nums">+{d}h</span>;
  return               <span className="text-[var(--warning)] font-semibold tabular-nums">{d}h</span>;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, accent, onClick, active }) {
  const base = `${card} relative px-5 py-4 overflow-hidden transition-all`;
  const interactive = onClick ? 'cursor-pointer hover:brightness-[0.97] dark:hover:brightness-110 select-none' : '';
  const ring = active ? 'ring-2 ring-offset-1 ring-[var(--accent)]' : '';
  return (
    <div className={`${base} ${interactive} ${ring}`} onClick={onClick}>
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: active ? 'var(--accent)' : accent }} />
      <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">{label}{active && <span className="ml-1.5 text-[var(--accent)]">✕</span>}</div>
      <div className={`text-[32px] font-semibold tabular-nums leading-none ${color}`}>{value}</div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ title, items, emptyMsg }) {
  if (!items.length) return (
    <div className={`${card} px-5 py-4 flex items-center gap-3`}>
      <span className="text-[18px]">✅</span>
      <span className="text-[14px] text-[var(--text-2)]">{emptyMsg}</span>
    </div>
  );
  return (
    <div className={`${card} border-[var(--warning)]/40 overflow-hidden`}>
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--warning)]/5">
        <span className="text-[13px] font-semibold text-[var(--warning)]">{title}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">{items.length}</span>
      </div>
      <div className="px-5 py-3 flex flex-wrap gap-2">
        {items.map(name => (
          <span key={name} className="px-2.5 py-1 rounded-full text-[12.5px] bg-[var(--surface-alt)] text-[var(--text-1)] border border-[var(--border-subtle)]">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Vertical Bar Chart ───────────────────────────────────────────────────────
const PALETTE = [
  '#7B68EE','#3B82F6','#10B981','#F59E0B','#EC4899',
  '#8B5CF6','#06B6D4','#84CC16','#F97316','#14B8A6',
  '#A855F7','#0EA5E9','#22C55E','#EAB308','#EF4444',
  '#6366F1','#0284C7','#65A30D','#D97706','#DC2626',
];

function VerticalBars({ title, badge, data, formatValue = v => v.toLocaleString('pt-BR') + 'h', maxItems = 20 }) {
  const shown = data.slice(0, maxItems);
  const max = useMemo(() => Math.max(1, ...shown.map(d => Math.abs(d.value))), [shown]);
  const [tooltip, setTooltip] = useState(null); // { name, value, x, y }

  // Label adaptativa: mais curta quanto mais barras
  const labelLen = shown.length <= 8 ? 20 : shown.length <= 14 ? 14 : 10;

  return (
    <div className={card}>
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold text-[15px]">{title}</h3>
          {badge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] uppercase tracking-wider">{badge}</span>}
        </div>
        {data.length > maxItems && <span className="text-[11px] text-[var(--text-3)]">top {maxItems} de {data.length}</span>}
      </div>
      {!shown.length ? (
        <div className="px-5 py-10 text-[15px] text-[var(--text-3)] text-center">Sem dados.</div>
      ) : (
        <div className="px-5 pt-5 pb-3 overflow-x-auto relative" onMouseLeave={() => setTooltip(null)}>
          {/* Tooltip flutuante */}
          {tooltip && (
            <div className="pointer-events-none fixed z-50 px-3 py-2 rounded-lg shadow-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-1)] text-[13px] max-w-[220px]"
              style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -110%)' }}>
              <div className="font-semibold leading-snug mb-0.5">{tooltip.name}</div>
              <div className="tabular-nums text-[var(--accent)] font-bold text-[15px]">{formatValue(tooltip.value)}</div>
            </div>
          )}
          <div className="flex items-end gap-3 min-h-[240px] pb-16" style={{ minWidth: Math.max(shown.length * 60, 360) }}>
            {shown.map((d, i) => {
              const h = Math.max(4, Math.round((Math.abs(d.value) / max) * 200));
              const color = d.color || PALETTE[i % PALETTE.length];
              const isActive = tooltip?.name === d.name;
              const label = d.name.length > labelLen ? d.name.slice(0, labelLen - 1) + '…' : d.name;
              return (
                <div key={d.name} className="flex flex-col items-center flex-1 min-w-[44px] relative group cursor-default"
                  onMouseEnter={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ name: d.name, value: d.value, x: rect.left + rect.width / 2, y: rect.top });
                  }}>
                  {/* Valor acima da barra */}
                  <span className={`text-[11px] tabular-nums mb-1 transition-colors ${isActive ? 'text-[var(--text-1)] font-semibold' : 'text-[var(--text-3)]'}`}>
                    {formatValue(d.value)}
                  </span>
                  {/* Barra */}
                  <div className="w-full rounded-t-[6px] transition-all duration-150"
                    style={{
                      height: h,
                      backgroundColor: color,
                      opacity: tooltip && !isActive ? 0.35 : 1,
                      transform: isActive ? 'scaleX(1.06)' : 'scaleX(1)',
                    }} />
                  {/* Label abaixo */}
                  <div className="w-full mt-2 flex justify-center">
                    <span className={`text-[11px] whitespace-nowrap block transition-colors ${isActive ? 'text-[var(--text-1)] font-semibold' : 'text-[var(--text-3)]'}`}
                      title={d.name}>
                      {label}
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

// ─── Weekly Bars (realizadas por semana) ──────────────────────────────────────
function WeeklyBarsConsolidated({ rows }) {
  const [hoveredWeek, setHoveredWeek] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const { weeks, max } = useMemo(() => {
    const byWeek = new Map();
    for (const r of rows || []) {
      const w = r.ISO_Week;
      if (!w) continue;
      const v = Number(r.Hours_Consolidated) || 0;
      byWeek.set(w, (byWeek.get(w) || 0) + v);
    }
    const weeks = Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0]).map(([w, v]) => ({ w, v }));
    return { weeks, max: Math.max(1, ...weeks.map(x => x.v)) };
  }, [rows]);
  if (!weeks.length) return null;
  return (
    <div className={card}>
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <h3 className="font-semibold text-[15px]">Evolução Semanal</h3>
        <span className="text-[11px] text-[var(--text-3)] uppercase tracking-wider">realizadas</span>
      </div>
      <div className="px-5 pt-4 pb-3 overflow-x-auto relative" onMouseLeave={() => { setHoveredWeek(null); setTooltip(null); }}>
        {tooltip && (
          <div className="pointer-events-none fixed z-50 px-3 py-2 rounded-lg shadow-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[13px]"
            style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -110%)' }}>
            <div className="font-semibold text-[var(--text-1)]">W{String(tooltip.w).padStart(2,'0')}</div>
            <div className="tabular-nums text-[var(--positive)] font-bold text-[15px]">{tooltip.v}h</div>
          </div>
        )}
        <div className="flex items-end gap-2 min-h-[120px]" style={{ minWidth: weeks.length * 36 }}>
          {weeks.map(({ w, v }) => {
            const h = Math.max(2, Math.round((v / max) * 110));
            const isActive = hoveredWeek === w;
            return (
              <div key={w} className="flex flex-col items-center gap-1.5 flex-1 cursor-default"
                onMouseEnter={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredWeek(w);
                  setTooltip({ w, v, x: rect.left + rect.width / 2, y: rect.top });
                }}>
                <span className={`text-[11px] tabular-nums transition-colors ${isActive ? 'text-[var(--text-1)] font-semibold' : 'text-[var(--text-3)]'}`}>{v || ''}</span>
                <div className="w-full rounded-t transition-all duration-150"
                  style={{ height: h, backgroundColor: 'var(--positive)', opacity: hoveredWeek && !isActive ? 0.3 : 0.85, transform: isActive ? 'scaleX(1.1)' : 'scaleX(1)' }} />
                <span className={`text-[11px] tabular-nums transition-colors ${isActive ? 'text-[var(--text-1)] font-semibold' : 'text-[var(--text-3)]'}`}>W{String(w).padStart(2,'0')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Heatmap Projeto × Semana ────────────────────────────────────────────────
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
      projectsSet.add(p); weeksSet.add(w);
      pivot[p] ??= {};
      pivot[p][w] = (pivot[p][w] || 0) + v;
    }
    const weeks = Array.from(weeksSet).sort((a, b) => a - b);
    const projTotals = {};
    for (const [p, byW] of Object.entries(pivot)) projTotals[p] = Object.values(byW).reduce((s, v) => s + v, 0);
    let projects = Array.from(projectsSet);
    if (sort === 'total') projects.sort((a, b) => Math.abs(projTotals[b]) - Math.abs(projTotals[a]));
    else if (sort === 'name') projects.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    else if (sort === 'recente') { const lw = weeks[weeks.length - 1]; projects.sort((a, b) => (pivot[b]?.[lw] || 0) - (pivot[a]?.[lw] || 0)); }
    const weekTotals = {};
    for (const w of weeks) weekTotals[w] = projects.reduce((s, p) => s + (pivot[p]?.[w] || 0), 0);
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

  if (!projects.length) return <div className="px-5 py-10 text-[15px] text-[var(--text-3)] text-center">Sem dados para o filtro atual.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="text-[12.5px] border-collapse" style={{ minWidth: 200 + weeks.length * 56 }}>
        <thead>
          <tr className="bg-[var(--surface-alt)] border-b border-[var(--border-subtle)]">
            <th className="sticky left-0 z-10 bg-[var(--surface-alt)] px-3 py-2.5 text-left text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide w-[220px]">Projeto</th>
            {weeks.map(w => <th key={w} className="px-1.5 py-2.5 text-center text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide tabular-nums">W{String(w).padStart(2,'0')}</th>)}
            <th className="sticky right-0 z-10 bg-[var(--surface-alt)] px-3 py-2.5 text-right text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {projects.map(p => (
            <tr key={p} className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
              <td className="sticky left-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--surface-alt)] px-3 py-2 text-[13.5px] truncate max-w-[220px]" title={p}>{p}</td>
              {weeks.map(w => {
                const v = pivot[p]?.[w] || 0;
                return <td key={w} className="text-center tabular-nums px-1 py-2" style={cellStyle(v)} title={v ? `W${String(w).padStart(2,'0')} · ${p}: ${v}h` : undefined}>{v ? (mode === 'desvio' && v > 0 ? `+${v}` : v) : ''}</td>;
              })}
              <td className="sticky right-0 z-10 bg-[var(--surface)] group-hover:bg-[var(--surface-alt)] px-3 py-2 text-right font-semibold tabular-nums">{projTotals[p]}h</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-alt)]">
            <td className="sticky left-0 bg-[var(--surface-alt)] px-3 py-2.5 text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Total/semana</td>
            {weeks.map(w => <td key={w} className="text-center tabular-nums px-1 py-2.5 font-semibold" style={{ color: weekTotals[w] ? 'var(--accent)' : undefined }}>{weekTotals[w] || ''}</td>)}
            <td className="sticky right-0 bg-[var(--surface-alt)] px-3 py-2.5 text-right font-bold tabular-nums">{total}h</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function groupBy(rows, key) {
  const map = new Map();
  for (const r of rows || []) {
    const g   = r[key] || "—";
    const agg = map.get(g) || { name: g, forecast: 0, consolidated: 0, hasConsolidated: false };
    agg.forecast += Number(r.Hours_Forecast) || 0;
    if (r.Hours_Consolidated != null) { agg.consolidated += Number(r.Hours_Consolidated) || 0; agg.hasConsolidated = true; }
    map.set(g, agg);
  }
  return Array.from(map.values())
    .map(x => ({ ...x, consolidated: x.hasConsolidated ? x.consolidated : null }))
    .sort((a, b) => b.forecast - a.forecast);
}

const selectCls = "w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-[14px] text-[var(--text-1)] focus:outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-colors";

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Dashboard({ db, projectMeta = {}, people = [], person = "", selectedWeek, selectedYear, recordsContent, onRefresh, loadingHistory, onPersonCardClick }) {
  const [activeTab, setActiveTab] = useState("semana");
  const [ocupFilter, setOcupFilter] = useState(null); // 'sem-alocacao' | 'parcial' | 'com40h' | 'pendentes'

  // ── Aba Semana ───────────────────────────────────────────────────────────────
  const weekRows = useMemo(() =>
    (db || []).filter(r => r.Year === selectedYear && r.ISO_Week === selectedWeek),
  [db, selectedYear, selectedWeek]);

  const prevWeekNum = selectedWeek === 1 ? 52 : selectedWeek - 1;
  const prevWeekYear = selectedWeek === 1 ? selectedYear - 1 : selectedYear;
  const prevWeekRows = useMemo(() =>
    (db || []).filter(r => r.Year === prevWeekYear && r.ISO_Week === prevWeekNum),
  [db, prevWeekYear, prevWeekNum]);

  const semKpis = useMemo(() => {
    const totalF = weekRows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
    const totalC = weekRows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
    const projetos = new Set(weekRows.filter(r => (Number(r.Hours_Forecast) || 0) > 0).map(r => r.Project)).size;
    const pessoas  = new Set(weekRows.filter(r => (Number(r.Hours_Forecast) || 0) > 0).map(r => r.Person)).size;
    return { totalF, totalC, projetos, pessoas };
  }, [weekRows]);

  const semSortField = useState("person");
  const [semSort, setSemSort] = useState("person");
  const [semCcFilter, setSemCcFilter] = useState("");
  const semCcs = useMemo(() => [...new Set(weekRows.map(r => r.Business_Unit).filter(Boolean))].sort(), [weekRows]);

  const semFiltered = useMemo(() => {
    let rows = weekRows;
    if (semCcFilter) rows = rows.filter(r => r.Business_Unit === semCcFilter);
    return [...rows].sort((a, b) => {
      if (semSort === "person")  return (a.Person  || "").localeCompare(b.Person  || "", 'pt-BR');
      if (semSort === "project") return (a.Project || "").localeCompare(b.Project || "", 'pt-BR');
      return 0;
    });
  }, [weekRows, semCcFilter, semSort]);

  const semPorProjeto = useMemo(() => {
    const map = new Map();
    for (const r of weekRows) {
      const p = r.Project;
      const f = Number(r.Hours_Forecast) || 0;
      if (!p || f <= 0) continue;
      map.set(p, (map.get(p) || 0) + f);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [weekRows]);

  const alertSemAlocacao = useMemo(() => {
    const alocados = new Set(weekRows.filter(r => (Number(r.Hours_Forecast) || 0) > 0).map(r => r.Person));
    return people.filter(p => !alocados.has(p)).sort();
  }, [weekRows, people]);

  const alertPendentes = useMemo(() => {
    const comPrevisto = new Set(prevWeekRows.filter(r => (Number(r.Hours_Forecast) || 0) > 0).map(r => r.Person));
    const comRealizado = new Set(prevWeekRows.filter(r => (Number(r.Hours_Consolidated) || 0) > 0).map(r => r.Person));
    return [...comPrevisto].filter(p => !comRealizado.has(p)).sort();
  }, [prevWeekRows]);

  // ── Aba Minha Visão ──────────────────────────────────────────────────────────
  const [viewPerson, setViewPerson] = useState(person || "");
  const allPeopleInDb = useMemo(() => [...new Set((db || []).map(r => r.Person).filter(Boolean))].sort(), [db]);

  const visaoRows = useMemo(() =>
    viewPerson ? (db || []).filter(r => r.Person === viewPerson).sort((a, b) => b.Year - a.Year || b.ISO_Week - a.ISO_Week) : [],
  [db, viewPerson]);

  const visaoKpis = useMemo(() => {
    const totalF = visaoRows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
    const totalC = visaoRows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
    const projetos = new Set(visaoRows.map(r => r.Project).filter(Boolean)).size;
    const semanas  = new Set(visaoRows.map(r => `${r.Year}-${r.ISO_Week}`)).size;
    const media    = semanas > 0 ? Math.round((totalF / semanas) * 10) / 10 : 0;
    return { totalF, totalC, projetos, media };
  }, [visaoRows]);

  const visaoPorProjeto = useMemo(() => {
    const map = new Map();
    for (const r of visaoRows) {
      const p = r.Project;
      const f = Number(r.Hours_Forecast) || 0;
      if (!p || f <= 0) continue;
      map.set(p, (map.get(p) || 0) + f);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [visaoRows]);

  const [visaoGroup, setVisaoGroup] = useState(false);
  const visaoProjetos = useMemo(() => {
    if (!visaoGroup) return null;
    const map = new Map();
    for (const r of visaoRows) {
      const p = r.Project || '—';
      const agg = map.get(p) || { project: p, forecast: 0, consolidated: 0, rows: [] };
      agg.forecast     += Number(r.Hours_Forecast) || 0;
      agg.consolidated += Number(r.Hours_Consolidated) || 0;
      agg.rows.push(r);
      map.set(p, agg);
    }
    return [...map.values()].sort((a, b) => b.forecast - a.forecast);
  }, [visaoRows, visaoGroup]);

  const [expandedProj, setExpandedProj] = useState(new Set());

  // ── Aba Panorama ─────────────────────────────────────────────────────────────
  const [includeInternos, setIncludeInternos] = useState(false);
  const [panFilter, setPanFilter] = useState({ cc: "", weekFrom: "", weekTo: "", person: "", project: "" });
  const [hmMode, setHmMode] = useState('forecast');
  const [hmSort, setHmSort] = useState('total');

  const allWeeks    = useMemo(() => [...new Set((db || []).map(r => r.ISO_Week).filter(Boolean))].sort((a, b) => a - b), [db]);
  const allCcs      = useMemo(() => [...new Set((db || []).map(r => r.Business_Unit).filter(Boolean))].sort(), [db]);
  const allPanPeople   = useMemo(() => [...new Set((db || []).map(r => r.Person).filter(Boolean))].sort(), [db]);
  const allPanProjects = useMemo(() => [...new Set((db || []).map(r => r.Project).filter(Boolean))].sort(), [db]);

  function isInternoProject(name) {
    if (!name) return false;
    if (projectMeta[name]?.isInterno) return true;
    return /^(Gestão|Comercial|Branding Sal|TI|G&C|Academia|Autorais|\[FÉRIAS\])/i.test(name);
  }

  const panoramaRows = useMemo(() => {
    let rows = db || [];
    if (panFilter.person)   rows = rows.filter(r => r.Person === panFilter.person);
    if (panFilter.project)  rows = rows.filter(r => r.Project === panFilter.project);
    if (panFilter.cc)       rows = rows.filter(r => r.Business_Unit === panFilter.cc);
    if (panFilter.weekFrom) rows = rows.filter(r => r.ISO_Week >= Number(panFilter.weekFrom));
    if (panFilter.weekTo)   rows = rows.filter(r => r.ISO_Week <= Number(panFilter.weekTo));
    if (!includeInternos)   rows = rows.filter(r => !isInternoProject(r.Project));
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, panFilter, includeInternos, projectMeta]);

  const realizadasPorProjeto = useMemo(() => {
    const map = new Map();
    for (const r of panoramaRows) {
      const co = Number(r.Hours_Consolidated) || 0;
      if (!r.Project || co <= 0) continue;
      map.set(r.Project, (map.get(r.Project) || 0) + co);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [panoramaRows]);

  const realizadasPorCC = useMemo(() => {
    const map = new Map();
    for (const r of panoramaRows) {
      const co = Number(r.Hours_Consolidated) || 0;
      if (!r.Business_Unit || co <= 0) continue;
      map.set(r.Business_Unit, (map.get(r.Business_Unit) || 0) + co);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [panoramaRows]);

  const realizadasPorCliente = useMemo(() => {
    const map = new Map();
    for (const r of panoramaRows) {
      const co = Number(r.Hours_Consolidated) || 0;
      if (!r.Project || co <= 0) continue;
      const cliente = projectMeta[r.Project]?.cliente || '— sem cliente —';
      map.set(cliente, (map.get(cliente) || 0) + co);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [panoramaRows, projectMeta]);

  const hasData = (db || []).length > 0;

  // ── Sub-tab nav ──────────────────────────────────────────────────────────────
  // ── Aba Semana 2 — grade de ocupação por pessoa ──────────────────────────────
  const ocupacaoPorPessoa = useMemo(() => {
    const map = new Map();
    for (const p of people) map.set(p, { person: p, forecast: 0, consolidated: 0 });
    for (const r of weekRows) {
      const p = r.Person;
      if (!p) continue;
      const agg = map.get(p) || { person: p, forecast: 0, consolidated: 0 };
      agg.forecast     += Number(r.Hours_Forecast)     || 0;
      agg.consolidated += Number(r.Hours_Consolidated) || 0;
      map.set(p, agg);
    }
    return [...map.values()].sort((a, b) => b.forecast - a.forecast);
  }, [weekRows, people]);

  const totalCom40h = useMemo(() =>
    ocupacaoPorPessoa.filter(p => p.forecast >= 40).length,
  [ocupacaoPorPessoa]);

  const TABS = [
    { k: "semana",    label: "Semana" },
    { k: "panorama",  label: "Panorama" },
    { k: "registros", label: "Registros" },
  ];

  return (
    <div className="space-y-5">

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] pb-0">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setActiveTab(t.k)}
            className={`px-4 py-2 text-[13.5px] font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
              activeTab === t.k
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)]'
            }`}>
            {t.label}
          </button>
        ))}
        {onRefresh && (
          <button onClick={onRefresh} disabled={loadingHistory}
            className="ml-auto text-[12.5px] text-[var(--text-2)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors px-2 pb-2">
            {loadingHistory ? "Atualizando…" : "↻ Atualizar"}
          </button>
        )}
      </div>

      {/* ══ REGISTROS ═══════════════════════════════════════════════════════════ */}
      {activeTab === "registros" && (
        <div className={card}>
          {recordsContent || (
            <div className="py-16 text-center text-[15px] text-[var(--text-3)]">
              Use "Carregar Semana" ou "Carregar Ano" para ver os dados.
            </div>
          )}
        </div>
      )}

      {!hasData && activeTab !== "registros" && (
        <div className="py-16 text-center text-[15px] text-[var(--text-3)]">
          Use "Carregar Semana" ou "Carregar Ano" para ver os dados.
        </div>
      )}

      {/* ══ SEMANA ══════════════════════════════════════════════════════════════ */}
      {hasData && activeTab === "semana" && (
        <div className="space-y-5">
          {/* KPIs da semana */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label={`Previstas — W${String(selectedWeek).padStart(2,'0')}`} value={semKpis.totalF + 'h'} color="text-[var(--accent)]" accent="var(--accent)" />
            <KpiCard label="Realizadas" value={semKpis.totalC > 0 ? semKpis.totalC + 'h' : '—'} color="text-[var(--positive)]" accent="var(--positive)" />
            <KpiCard label="Projetos ativos" value={semKpis.projetos.toString()} color="text-[var(--warning)]" accent="var(--warning)" />
            <KpiCard label="Colaboradores" value={semKpis.pessoas.toString()} color="text-[var(--accent)]" accent="var(--accent)" />
          </div>

          {/* Horas previstas por projeto */}
          {semPorProjeto.length > 0 && (
            <VerticalBars
              title={`Horas Previstas por Projeto — W${String(selectedWeek).padStart(2,'0')}`}
              badge="previsto"
              data={semPorProjeto}
            />
          )}

          {/* KPIs de ocupação — clicáveis como filtros da grade */}
          {(() => {
            const toggle = key => setOcupFilter(f => f === key ? null : key);
            const pendentesSet = new Set(alertPendentes);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label={`Com 40h — W${String(selectedWeek).padStart(2,'0')}`}
                  value={`${totalCom40h} / ${ocupacaoPorPessoa.length}`}
                  color={totalCom40h === ocupacaoPorPessoa.length ? 'text-[var(--positive)]' : 'text-[var(--warning)]'}
                  accent={totalCom40h === ocupacaoPorPessoa.length ? 'var(--positive)' : 'var(--warning)'}
                  onClick={() => toggle('com40h')} active={ocupFilter === 'com40h'}
                />
                <KpiCard
                  label="Parcialmente alocados"
                  value={ocupacaoPorPessoa.filter(p => p.forecast > 0 && p.forecast < 40).length.toString()}
                  color="text-[var(--accent)]" accent="var(--accent)"
                  onClick={() => toggle('parcial')} active={ocupFilter === 'parcial'}
                />
                <KpiCard
                  label="Sem alocação"
                  value={ocupacaoPorPessoa.filter(p => p.forecast === 0).length.toString()}
                  color="text-[var(--negative)]" accent="var(--negative)"
                  onClick={() => toggle('sem-alocacao')} active={ocupFilter === 'sem-alocacao'}
                />
                <KpiCard
                  label="Realizadas pendentes"
                  value={alertPendentes.length.toString()}
                  color={alertPendentes.length > 0 ? 'text-[var(--warning)]' : 'text-[var(--positive)]'}
                  accent={alertPendentes.length > 0 ? 'var(--warning)' : 'var(--positive)'}
                  onClick={() => toggle('pendentes')} active={ocupFilter === 'pendentes'}
                />
              </div>
            );
          })()}

          {/* Grade de ocupação por colaborador */}
          {(() => {
            const pendentesSet = new Set(alertPendentes);
            const filtered = ocupacaoPorPessoa.filter(p => {
              if (!ocupFilter) return true;
              if (ocupFilter === 'com40h')      return p.forecast >= 40;
              if (ocupFilter === 'parcial')     return p.forecast > 0 && p.forecast < 40;
              if (ocupFilter === 'sem-alocacao') return p.forecast === 0;
              if (ocupFilter === 'pendentes')   return pendentesSet.has(p.person);
              return true;
            });
            return (
              <div className={card}>
                <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <h3 className="font-semibold text-[15px]">Ocupação por Colaborador — W{String(selectedWeek).padStart(2,'0')}</h3>
                  {ocupFilter && (
                    <button onClick={() => setOcupFilter(null)}
                      className="text-[12px] text-[var(--accent)] hover:underline">
                      Limpar filtro
                    </button>
                  )}
                </div>
                <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map(p => {
                    const pct = Math.min(100, Math.round((p.forecast / 40) * 100));
                    const over = p.forecast > 40;
                    const full = p.forecast === 40;
                    const partial = p.forecast > 0 && p.forecast < 40;
                    const empty = p.forecast === 0;
                    const barColor = over ? 'var(--negative)' : full ? 'var(--positive)' : partial ? 'var(--accent)' : 'var(--border-strong)';
                    const badgeColor = over
                      ? 'bg-[var(--negative)]/10 text-[var(--negative)]'
                      : full ? 'bg-[var(--positive)]/10 text-[var(--positive)]'
                      : partial ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'bg-[var(--surface-alt)] text-[var(--text-3)]';
                    const hasReal = p.consolidated > 0;
                    return (
                      <div key={p.person} onClick={() => onPersonCardClick?.(p.person)} className={`${card} p-3 space-y-2 ${onPersonCardClick ? 'cursor-pointer hover:ring-1 hover:ring-[var(--accent)] transition-shadow' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.5px] font-medium truncate" title={p.person}>{p.person}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
                            {empty ? '0h' : `${p.forecast}h`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                        {hasReal && (
                          <div className="flex items-center justify-between text-[11.5px] text-[var(--text-3)]">
                            <span>Realizadas</span>
                            <span className={`font-semibold tabular-nums ${p.consolidated >= p.forecast ? 'text-[var(--positive)]' : 'text-[var(--warning)]'}`}>
                              {p.consolidated}h
                            </span>
                          </div>
                        )}
                        {!hasReal && !empty && (
                          <div className="text-[11px] text-[var(--text-3)]">Realizadas pendentes</div>
                        )}
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="col-span-full py-8 text-center text-[14px] text-[var(--text-3)]">Nenhum colaborador neste filtro.</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ MINHA VISÃO ═════════════════════════════════════════════════════════ */}
      {hasData && activeTab === "visao" && (
        <div className="space-y-5">
          {/* Seletor de pessoa */}
          <div className={`${card} p-4`}>
            <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Colaborador</label>
            <select value={viewPerson} onChange={e => setViewPerson(e.target.value)} className={`${selectCls} max-w-sm`}>
              <option value="">Selecionar…</option>
              {allPeopleInDb.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {viewPerson && (
            <>
              {/* KPIs pessoais */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Total Previstas"  value={visaoKpis.totalF + 'h'}  color="text-[var(--accent)]"   accent="var(--accent)" />
                <KpiCard label="Total Realizadas" value={visaoKpis.totalC > 0 ? visaoKpis.totalC + 'h' : '—'} color="text-[var(--positive)]" accent="var(--positive)" />
                <KpiCard label="Projetos"         value={visaoKpis.projetos.toString()} color="text-[var(--warning)]" accent="var(--warning)" />
                <KpiCard label="Média/semana"     value={visaoKpis.media + 'h'} color="text-[var(--text-1)]" accent="var(--border-strong)" />
              </div>

              {/* Gráfico por projeto */}
              {visaoPorProjeto.length > 0 && (
                <VerticalBars
                  title="Horas Previstas por Projeto"
                  badge="período"
                  data={visaoPorProjeto}
                />
              )}

              {/* Toggle agrupamento */}
              <div className="flex justify-end">
                <label className="text-[12px] text-[var(--text-3)] inline-flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={visaoGroup} onChange={e => { setVisaoGroup(e.target.checked); setExpandedProj(new Set()); }} className="accent-[var(--accent)]" />
                  agrupar por projeto
                </label>
              </div>

              {/* Tabela histórica — flat */}
              {!visaoGroup && (
                <div className={card}>
                  <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                    <h3 className="font-semibold text-[15px]">Histórico — {viewPerson}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]/40">
                          <th className={th}>Ano</th>
                          <th className={th}>Semana</th>
                          <th className={th}>Projeto</th>
                          <th className={th}>CC</th>
                          <th className={`${th} text-right`}>Previstas</th>
                          <th className={`${th} text-right`}>Realizadas</th>
                          <th className={`${th} text-right`}>Desvio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {visaoRows.map((r, i) => {
                          const fc = Number(r.Hours_Forecast) || 0;
                          const co = r.Hours_Consolidated != null ? Number(r.Hours_Consolidated) : null;
                          return (
                            <tr key={r._taskId || i} className="hover:bg-[var(--surface-alt)] transition-colors">
                              <td className={`${td} tabular-nums text-[var(--text-3)]`}>{r.Year}</td>
                              <td className={`${td} tabular-nums font-medium`}>W{String(r.ISO_Week).padStart(2,'0')}</td>
                              <td className={`${td}`}>{r.Project}</td>
                              <td className={`${td} text-[var(--text-3)] text-[12.5px]`}>{r.Business_Unit}</td>
                              <td className={`${td} text-right tabular-nums`}>{fc}h</td>
                              <td className={`${td} text-right tabular-nums`}>{co != null ? co + 'h' : '—'}</td>
                              <td className={`${td} text-right`}><DesvioCell d={co != null ? co - fc : null} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela histórica — agrupada por projeto */}
              {visaoGroup && visaoProjetos && (
                <div className="space-y-2">
                  {visaoProjetos.map(proj => {
                    const open = expandedProj.has(proj.project);
                    return (
                      <div key={proj.project} className={card}>
                        <button
                          onClick={() => setExpandedProj(prev => { const s = new Set(prev); open ? s.delete(proj.project) : s.add(proj.project); return s; })}
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-[var(--surface-alt)] transition-colors rounded-xl">
                          <span className="font-medium text-[14px]">{proj.project}</span>
                          <div className="flex items-center gap-4 text-[13px] tabular-nums text-[var(--text-2)]">
                            <span>Prev: <strong>{proj.forecast}h</strong></span>
                            {proj.consolidated > 0 && <span>Real: <strong className="text-[var(--positive)]">{proj.consolidated}h</strong></span>}
                            <span className="text-[var(--text-3)] text-[11px]">{open ? '▲' : '▼'}</span>
                          </div>
                        </button>
                        {open && (
                          <div className="border-t border-[var(--border-subtle)] overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-[var(--surface-alt)]/40 border-b border-[var(--border-subtle)]">
                                  <th className={th}>Ano</th>
                                  <th className={th}>Semana</th>
                                  <th className={`${th} text-right`}>Previstas</th>
                                  <th className={`${th} text-right`}>Realizadas</th>
                                  <th className={`${th} text-right`}>Desvio</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)]">
                                {proj.rows.map((r, i) => {
                                  const fc = Number(r.Hours_Forecast) || 0;
                                  const co = r.Hours_Consolidated != null ? Number(r.Hours_Consolidated) : null;
                                  return (
                                    <tr key={r._taskId || i} className="hover:bg-[var(--surface-alt)]">
                                      <td className={`${td} tabular-nums text-[var(--text-3)]`}>{r.Year}</td>
                                      <td className={`${td} tabular-nums`}>W{String(r.ISO_Week).padStart(2,'0')}</td>
                                      <td className={`${td} text-right tabular-nums`}>{fc}h</td>
                                      <td className={`${td} text-right tabular-nums`}>{co != null ? co + 'h' : '—'}</td>
                                      <td className={`${td} text-right`}><DesvioCell d={co != null ? co - fc : null} /></td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ PANORAMA ════════════════════════════════════════════════════════════ */}
      {hasData && activeTab === "panorama" && (
        <div className="space-y-5">
          {/* Filtros */}
          <div className={`${card} p-4`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Pessoa</label>
                <select value={panFilter.person} onChange={e => setPanFilter(f => ({ ...f, person: e.target.value }))} className={selectCls}>
                  <option value="">Todos</option>
                  {allPanPeople.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Projeto</label>
                <select value={panFilter.project} onChange={e => setPanFilter(f => ({ ...f, project: e.target.value }))} className={selectCls}>
                  <option value="">Todos</option>
                  {allPanProjects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Centro de Custo</label>
                <select value={panFilter.cc} onChange={e => setPanFilter(f => ({ ...f, cc: e.target.value }))} className={selectCls}>
                  <option value="">Todos</option>
                  {allCcs.map(cc => <option key={cc} value={cc}>{cc}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Semana de</label>
                <select value={panFilter.weekFrom} onChange={e => setPanFilter(f => ({ ...f, weekFrom: e.target.value }))} className={selectCls}>
                  <option value="">Início</option>
                  {allWeeks.map(w => <option key={w} value={String(w)}>W{String(w).padStart(2,'0')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide mb-1.5">Até</label>
                <select value={panFilter.weekTo} onChange={e => setPanFilter(f => ({ ...f, weekTo: e.target.value }))} className={selectCls}>
                  <option value="">Fim</option>
                  {allWeeks.map(w => <option key={w} value={String(w)}>W{String(w).padStart(2,'0')}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="text-[12px] text-[var(--text-3)] inline-flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap pb-2">
                  <input type="checkbox" checked={includeInternos} onChange={e => setIncludeInternos(e.target.checked)} className="accent-[var(--accent)]" />
                  internos
                </label>
                {(panFilter.person || panFilter.project || panFilter.cc || panFilter.weekFrom || panFilter.weekTo) && (
                  <button onClick={() => setPanFilter({ person: "", project: "", cc: "", weekFrom: "", weekTo: "" })}
                    className="pb-2 text-[13px] text-[var(--accent)] font-medium whitespace-nowrap">
                    ↺ Limpar
                  </button>
                )}
              </div>
            </div>
            <div className="mt-2 text-[12px] text-[var(--text-3)]">{panoramaRows.length} registros</div>
          </div>

          {/* Evolução semanal */}
          <WeeklyBarsConsolidated rows={panoramaRows} />

          {/* Por Projeto */}
          <VerticalBars title="Horas Realizadas por Projeto" badge="realizado" data={realizadasPorProjeto} maxItems={20} />

          {/* Por CC */}
          <VerticalBars title="Horas Realizadas por Centro de Custo" badge="realizado" data={realizadasPorCC} maxItems={20} />

          {/* Por Cliente */}
          <VerticalBars title="Horas Realizadas por Cliente" badge="realizado" data={realizadasPorCliente} maxItems={20} />

          {/* Heatmap */}
          <div className={card}>
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-semibold text-[15px]">Detalhamento Projeto × Semana</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex bg-[var(--surface-alt)] rounded-md p-0.5 gap-0.5 border border-[var(--border-subtle)]">
                  {[{k:'forecast',label:'Previsto'},{k:'consolidated',label:'Realizado'},{k:'desvio',label:'Desvio'}].map(o => (
                    <button key={o.k} onClick={() => setHmMode(o.k)}
                      className={`px-3 py-1 rounded-[7px] text-[12px] font-medium transition-all ${hmMode===o.k ? 'bg-[var(--surface)] text-[var(--text-1)] shadow-sm' : 'text-[var(--text-2)]'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <select value={hmSort} onChange={e => setHmSort(e.target.value)} className="text-[12px] rounded-[9px] border border-[var(--border-subtle)] bg-[var(--surface-alt)] px-2 py-1">
                  <option value="total">Sort: Total</option>
                  <option value="recente">Sort: Recente</option>
                  <option value="name">Sort: Nome</option>
                </select>
              </div>
            </div>
            <Heatmap rows={panoramaRows} mode={hmMode} sort={hmSort} />
          </div>
        </div>
      )}
    </div>
  );
}
