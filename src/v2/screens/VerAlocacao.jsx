import { useState, useEffect, useCallback, useRef } from 'react';
import { getISOWeek, getMonth, getYear } from 'date-fns';
import { loadForWeek } from '../../lib/clickup/entries.js';
import { getWeekCap } from '../lib/feriados.js';
import { ccColor } from '../../lib/clickup/fields.js';

// Semanas ISO que pertencem a um dado mês/ano (pelo critério da quinta-feira).
function weeksOfMonth(year, month) {
  const weeks = [];
  // Percorre todos os dias do mês e coleta semanas únicas
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const w = getISOWeek(d);
    const wy = d.getDay() === 4 // quinta-feira define o ano ISO
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

function calcStatus(rows, cap) {
  const f = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const c = rows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
  if (!f && !c) return { type: 'vazio',    label: 'sem alocação',          cls: 'text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border)]' };
  if (f > cap)  return { type: 'excedido', label: `excedido · ${f}h`,      cls: 'text-[var(--negative-text)] bg-[var(--negative-soft)]' };
  if (f < cap && c === 0) return { type: 'gap',   label: `gap · ${f}/${cap}h`,  cls: 'text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-900/20' };
  if (c === 0)  return { type: 'pendente', label: `pendente · ${f}h`,       cls: 'text-[var(--warning-text)] bg-[var(--warning-soft)]' };
  if (c >= f)   return { type: 'fechado',  label: `fechado · ${c}h`,        cls: 'text-[var(--positive-text)] bg-[var(--positive-soft)]' };
  return        { type: 'parcial',         label: `parcial · ${c}/${f}h`,   cls: 'text-[var(--info-text)] bg-[var(--info-soft)]' };
}

function StatusBar({ rows, cap }) {
  const f = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const c = rows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
  const pctF = Math.min(100, Math.round((f / cap) * 100));
  const pctC = Math.min(100, Math.round((c / cap) * 100));
  const over = f > cap;
  const barColor = over ? 'bg-[var(--negative)]' : c > 0 && c >= f ? 'bg-[var(--positive)]' : f > 0 ? 'bg-[var(--accent)]' : 'bg-[var(--border)]';

  return (
    <div className="w-full h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pctF}%` }} />
      {pctC > 0 && pctC < pctF && (
        <div className="h-full rounded-full bg-[var(--positive)] -mt-1.5 transition-all" style={{ width: `${pctC}%` }} />
      )}
    </div>
  );
}

function PersonRow({ person, rows, cap, monthRows, monthLoading }) {
  const [expanded, setExpanded] = useState(true);
  const [monthExpanded, setMonthExpanded] = useState(false);
  const status = calcStatus(rows, cap);
  const totalF = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const totalC = rows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);

  const monthF = (monthRows || []).reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const monthC = (monthRows || []).reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--surface-raised)] transition-colors"
      >
        <span className="text-[var(--text-secondary)] text-xs w-4">{expanded ? '▼' : '▶'}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-[var(--text-primary)] truncate">{person.name}</span>
            {person.unidade && (
              <span className="text-xs text-[var(--text-secondary)] shrink-0">{person.unidade}</span>
            )}
          </div>
          <StatusBar rows={rows} cap={cap} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="tabular-nums text-sm text-[var(--text-secondary)]">
            {totalF}h<span className="text-[var(--border)] mx-1">/</span>{cap}h
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
            {status.label}
          </span>
        </div>
      </button>

      {/* Projetos da semana */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {rows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--text-secondary)]">Sem alocações nesta semana.</p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {rows.map((r, i) => {
                const desvio = (Number(r.Hours_Consolidated) || 0) - (Number(r.Hours_Forecast) || 0);
                return (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ccColor(r.Business_Unit) }} />
                    <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{r.Project}</span>
                    <span className="text-xs text-[var(--text-secondary)] shrink-0">{r.Business_Unit}</span>
                    <div className="flex items-center gap-3 shrink-0 tabular-nums text-sm">
                      <span className="text-[var(--text-secondary)]">{r.Hours_Forecast ?? '—'}h prev</span>
                      <span className={r.Hours_Consolidated ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}>
                        {r.Hours_Consolidated ?? '—'}h real
                      </span>
                      {desvio !== 0 && (
                        <span className={`text-xs ${desvio > 0 ? 'text-[var(--positive-text)]' : 'text-[var(--negative-text)]'}`}>
                          {desvio > 0 ? `+${desvio}` : desvio}h
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Acumulado mensal */}
          <div className="border-t border-[var(--border-subtle)] px-4 py-2">
            <button
              onClick={() => setMonthExpanded(e => !e)}
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              {monthExpanded ? '▼' : '▶'} Acumulado do mês
              {monthLoading && <span className="animate-pulse ml-1">…</span>}
              {!monthLoading && monthRows && (
                <span className="text-[var(--text-secondary)] ml-1">
                  · {monthF}h prev · {monthC}h real
                </span>
              )}
            </button>

            {monthExpanded && !monthLoading && monthRows && (
              <div className="mt-2 space-y-1">
                {/* Agrupa por projeto */}
                {Object.entries(
                  monthRows.reduce((acc, r) => {
                    const key = r.Project;
                    if (!acc[key]) acc[key] = { f: 0, c: 0, cc: r.Business_Unit };
                    acc[key].f += Number(r.Hours_Forecast) || 0;
                    acc[key].c += Number(r.Hours_Consolidated) || 0;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1].f - a[1].f)
                  .map(([proj, data]) => (
                    <div key={proj} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ccColor(data.cc) }} />
                      <span className="flex-1 text-[var(--text-secondary)] truncate">{proj}</span>
                      <span className="tabular-nums text-[var(--text-primary)]">{data.f}h prev</span>
                      <span className={`tabular-nums ${data.c > 0 ? 'text-[var(--positive-text)]' : 'text-[var(--text-secondary)]'}`}>
                        {data.c}h real
                      </span>
                    </div>
                  ))}
                <div className="pt-1 mt-1 border-t border-[var(--border-subtle)] flex justify-between text-xs font-semibold">
                  <span className="text-[var(--text-secondary)]">Total mês</span>
                  <span className="tabular-nums">{monthF}h prev · {monthC}h real</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerAlocacao({ people, year, week }) {
  const cap = getWeekCap(year, week);
  const [weekData, setWeekData]   = useState({});   // personName → rows[]
  const [monthData, setMonthData] = useState({});   // personName → rows[]
  const [loadingWeek, setLoadingWeek]   = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const weekRef = useRef({ year, week });

  // Carrega semana
  const loadWeek = useCallback(async (yr, wk, peopleList) => {
    if (!peopleList.length) return;
    weekRef.current = { year: yr, week: wk };
    setLoadingWeek(true);
    setWeekData({});
    try {
      const rows = await loadForWeek(yr, wk);
      if (weekRef.current.year !== yr || weekRef.current.week !== wk) return;
      const byPerson = {};
      for (const p of peopleList) {
        byPerson[p.name] = rows.filter(r => r.Person === p.name);
      }
      setWeekData(byPerson);
    } catch (e) {
      console.error('[VerAlocacao] loadWeek error:', e);
    } finally {
      setLoadingWeek(false);
    }
  }, []);

  useEffect(() => {
    loadWeek(year, week, people);
  }, [year, week, people, loadWeek]);

  // Carrega acumulado do mês ao expandir (lazy) — dispara quando monthData está vazio
  // e o mês atual do week selecionado está definido
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
      .catch(e => console.error('[VerAlocacao] loadMonth error:', e))
      .finally(() => setLoadingMonth(false));
  }, [year, week, people]);

  // KPIs da semana
  const allWeekRows = Object.values(weekData).flat();
  const totalF = allWeekRows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const totalC = allWeekRows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
  const comGap = people.filter(p => {
    const rows = weekData[p.name] || [];
    const f = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
    return f > 0 && f < cap;
  }).length;
  const fechados = people.filter(p => {
    const rows = weekData[p.name] || [];
    const f = rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
    const c = rows.reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);
    return f > 0 && c >= f;
  }).length;
  const semAlocacao = people.filter(p => {
    const rows = weekData[p.name] || [];
    return rows.length === 0 || rows.reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0) === 0;
  }).length;

  if (!people.length) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">
        <p className="text-sm">Selecione uma unidade para ver as alocações.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-20 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Previstas',     value: `${totalF}h` },
          { label: 'Realizadas',    value: `${totalC}h` },
          { label: 'Com gap',       value: comGap,        warn: comGap > 0 },
          { label: 'Sem alocação',  value: semAlocacao,   warn: semAlocacao > 0 },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-3 text-center ${k.warn ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
            <div className={`text-xl font-semibold tabular-nums ${k.warn ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--text-primary)]'}`}>{k.value}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {loadingWeek && (
        <p className="text-sm text-[var(--text-secondary)] animate-pulse">Carregando semana…</p>
      )}

      {/* Lista de pessoas */}
      <div className="space-y-2">
        {people.map(person => (
          <PersonRow
            key={person.name}
            person={person}
            rows={weekData[person.name] || []}
            cap={cap}
            monthRows={monthData[person.name] || null}
            monthLoading={loadingMonth}
          />
        ))}
      </div>
    </div>
  );
}
