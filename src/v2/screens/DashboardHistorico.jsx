import { useState, useEffect, useMemo, useCallback } from 'react';
import { getISOWeek, getMonth, getYear, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { loadForWeek, loadLastYear } from '../../lib/clickup/entries.js';
import { ccColor, CENTRO_DE_CUSTO_OPTIONS } from '../../lib/clickup/fields.js';

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
  // segments: [{name, value, color}]
  const shown = segments.filter(s => s.value > 0);
  let cum = 0;
  const stops = shown.map(s => {
    const pct = (s.value / total) * 100;
    const from = cum.toFixed(2);
    cum += pct;
    return `${s.color} ${from}% ${cum.toFixed(2)}%`;
  });
  const gradient = shown.length
    ? `conic-gradient(from -90deg, ${stops.join(', ')})`
    : `conic-gradient(var(--border) 0% 100%)`;

  return (
    <div className="relative flex-shrink-0" style={{ width: 148, height: 148 }}>
      <div style={{
        width: 148, height: 148,
        borderRadius: '50%',
        background: gradient,
      }} />
      {/* Hole */}
      <div className="absolute rounded-full bg-[var(--surface)] flex flex-col items-center justify-center"
        style={{ inset: '26%' }}>
        <span className="font-display tabular-nums text-[20px] font-semibold leading-none text-[var(--text-primary)]">
          {centerLabel}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-[var(--text-secondary)] mt-0.5">
          {centerSub}
        </span>
      </div>
    </div>
  );
}

// ── Insight Hero ──────────────────────────────────────────────────────────────
function InsightHero({ rows }) {
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
        <DonutChart
          segments={segments}
          total={totalF}
          centerLabel={totalF}
          centerSub="horas"
        />
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
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.pct}%`, background: s.color }} />
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

// ── Project Bars ──────────────────────────────────────────────────────────────
function ProjectBars({ rows }) {
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
    return [...map.values()]
      .filter(g => g.f > 0)
      .sort((a, b) => b.f - a.f)
      .slice(0, 10)
      .map(g => ({ ...g, people: [...g.people] }));
  }, [rows]);

  if (!byProject.length) return null;
  const max = byProject[0]?.f || 1;

  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-4">Projetos por horas previstas</p>
      <div className="space-y-3">
        {byProject.map((p, i) => (
          <div key={p.name} className="group">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ccColor(p.cc) }} />
              <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{p.name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="tabular-nums text-xs text-[var(--text-secondary)]">
                  {p.people.slice(0, 3).join(', ')}{p.people.length > 3 ? ` +${p.people.length - 3}` : ''}
                </span>
                <span className="tabular-nums text-sm font-medium text-[var(--text-primary)] w-10 text-right">{p.f}h</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(p.f / max) * 100}%`,
                  background: ccColor(p.cc),
                  opacity: p.c > 0 ? 1 : 0.6,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── People Status ─────────────────────────────────────────────────────────────
function PeopleStatus({ rows, people }) {
  const byPerson = useMemo(() => {
    const map = new Map();
    for (const p of people) map.set(p.name, { name: p.name, f: 0, c: 0 });
    for (const r of rows) {
      if (!r.Person) continue;
      const g = map.get(r.Person) || { name: r.Person, f: 0, c: 0 };
      g.f += Number(r.Hours_Forecast) || 0;
      g.c += Number(r.Hours_Consolidated) || 0;
      map.set(r.Person, g);
    }
    return [...map.values()];
  }, [rows, people]);

  const fechados  = byPerson.filter(p => p.f > 0 && p.c >= p.f);
  const pendentes = byPerson.filter(p => p.f > 0 && p.c < p.f);
  const semAloc   = byPerson.filter(p => p.f === 0);

  const Chip = ({ name, color, dot }) => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)]">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {name.split(' ')[0]}
    </span>
  );

  const groups = [
    { label: 'Fechados', items: fechados,  color: 'var(--positive)' },
    { label: 'Pendentes', items: pendentes, color: 'var(--warning)' },
    { label: 'Sem alocação', items: semAloc, color: 'var(--border)' },
  ].filter(g => g.items.length > 0);

  if (!groups.length) return null;

  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <p className="text-[11px] uppercase tracking-widest text-[var(--text-secondary)] mb-4">Pessoas</p>
      <div className="space-y-3">
        {groups.map(g => (
          <div key={g.label} className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 w-24 flex-shrink-0 pt-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
              <span className="text-xs text-[var(--text-secondary)]">{g.label}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map(p => <Chip key={p.name} name={p.name} color={g.color} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const MONTH_KEY = 'ts:cache:dash:month:v2';
const YEAR_KEY  = 'ts:cache:dash:year:v2';

export default function DashboardHistorico({ people, year, week }) {
  const [periodo, setPeriodo] = useState('mes');
  const [monthRows, setMonthRows] = useState(null);
  const [yearRows,  setYearRows]  = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingYear,  setLoadingYear]  = useState(false);
  const [yearProgress, setYearProgress] = useState(0);

  const selDate = useMemo(() => mondayOfWeek(year, week), [year, week]);
  const monthLabel = format(selDate, 'MMMM yyyy', { locale: ptBR });
  const currentMonth = getMonth(selDate);
  const currentMonthYear = getYear(selDate);

  const loadMonth = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(MONTH_KEY), null);
    if (isCacheFresh(cached) && Array.isArray(cached.data)) { setMonthRows(cached.data); return; }
    setLoadingMonth(true);
    try {
      const wks = weeksOfMonth(currentMonthYear, currentMonth);
      const results = await Promise.all(wks.map(w => loadForWeek(w.year, w.week)));
      const rows = results.flat();
      setMonthRows(rows);
      localStorage.setItem(MONTH_KEY, JSON.stringify({ data: rows, savedAt: Date.now() }));
    } catch (e) { console.error(e); }
    finally { setLoadingMonth(false); }
  }, [currentMonth, currentMonthYear]);

  const loadYear = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(YEAR_KEY), null);
    if (isCacheFresh(cached, 30 * 60 * 1000) && Array.isArray(cached.data)) { setYearRows(cached.data); return; }
    setLoadingYear(true); setYearProgress(0);
    try {
      const rows = await loadLastYear(year, { onProgress: n => setYearProgress(n) });
      setYearRows(rows);
      localStorage.setItem(YEAR_KEY, JSON.stringify({ data: rows, savedAt: Date.now() }));
    } catch (e) { console.error(e); }
    finally { setLoadingYear(false); }
  }, [year]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const rows = periodo === 'mes' ? (monthRows || []) : (yearRows || []);
  const isLoading = periodo === 'mes' ? loadingMonth : loadingYear;
  const needsLoad = periodo === 'ano' && yearRows === null && !loadingYear;

  return (
    <div className="px-4 py-4 pb-24 space-y-3">

      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-[2px] p-[3px] bg-[var(--surface-raised)] rounded-full border border-[var(--border)]">
          <button onClick={() => setPeriodo('mes')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all capitalize ${
              periodo === 'mes' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'
            }`}>
            {monthLabel}
          </button>
          <button onClick={() => { setPeriodo('ano'); if (!yearRows && !loadingYear) loadYear(); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
              periodo === 'ano' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'
            }`}>
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
          <InsightHero rows={rows} />
          <CCDistribution rows={rows} />
          <ProjectBars rows={rows} />
          <PeopleStatus rows={rows} people={people} />
        </>
      )}
    </div>
  );
}
