import { useState, useEffect } from 'react';
import { CENTRO_DE_CUSTO_OPTIONS, ccColor } from '../../lib/clickup/fields.js';
import Combobox from './Combobox.jsx';

function StatusBar({ totalF, totalC, cap }) {
  const pctF = Math.min(100, cap > 0 ? Math.round((totalF / cap) * 100) : 0);
  const pctC = Math.min(100, cap > 0 ? Math.round((totalC / cap) * 100) : 0);
  const over = totalF > cap;
  const colorF = over ? 'var(--negative)' : totalF > 0 ? 'var(--accent)' : 'var(--border)';
  const colorC = totalC > cap ? 'var(--negative)' : totalC > 0 ? 'var(--positive)' : 'var(--border)';
  return (
    <div className="space-y-0.5 mt-1.5">
      <div className="w-full h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctF}%`, background: colorF }} />
      </div>
      <div className="w-full h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pctC}%`, background: colorC }} />
      </div>
    </div>
  );
}

function uid() { return Math.random().toString(36).slice(2); }

function calcStatus(rows, cap) {
  const totalF = rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
  const totalC = rows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
  if (!totalF && !totalC) return { type: 'vazio', label: `sem alocação`, cls: 'text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border)]' };
  if (totalC > cap) return { type: 'excedido', label: `excedido · ${totalC}h realizadas`, cls: 'text-[var(--negative-text)] bg-[var(--negative-soft)] border border-[var(--negative-soft)]' };
  if (totalF > cap) return { type: 'excedido', label: `excedido · ${totalF}h previstas`,  cls: 'text-[var(--negative-text)] bg-[var(--negative-soft)] border border-[var(--negative-soft)]' };
  if (totalF < cap && totalC === 0) return { type: 'gap',      label: `gap · ${totalF}/${cap}h`, cls: 'text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800' };
  if (totalC === 0)   return { type: 'pendente', label: `pendente · 0/${totalF}h`,          cls: 'text-[var(--warning-text)] bg-[var(--warning-soft)]' };
  if (totalC >= totalF) return { type: 'fechado', label: `fechado · ${totalC}h`,            cls: 'text-[var(--positive-text)] bg-[var(--positive-soft)]' };
  return { type: 'parcial', label: `parcial · ${totalC}/${totalF}h`,                         cls: 'text-[var(--info-text)] bg-[var(--info-soft)]' };
}

function MonthAccumulated({ monthRows, monthLoading }) {
  const [expanded, setExpanded] = useState(false);
  const monthF = (monthRows || []).reduce((s, r) => s + (Number(r.Hours_Forecast) || 0), 0);
  const monthC = (monthRows || []).reduce((s, r) => s + (Number(r.Hours_Consolidated) || 0), 0);

  return (
    <div className="border-t border-[var(--border-subtle)] px-4 py-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
      >
        {expanded ? '▼' : '▶'} Acumulado do mês
        {monthLoading && <span className="animate-pulse ml-1">…</span>}
        {!monthLoading && monthRows && (
          <span className="text-[var(--text-secondary)] ml-1">
            · {monthF}h prev · {monthC}h real
          </span>
        )}
      </button>

      {expanded && !monthLoading && monthRows && (
        <div className="mt-2 space-y-1">
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
  );
}

function HoursInput({ value, onChange, disabled }) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'PageUp')   { e.preventDefault(); onChange(Math.min(99, (Number(value) || 0) + 4)); }
        if (e.key === 'PageDown') { e.preventDefault(); onChange(Math.max(0,  (Number(value) || 0) - 4)); }
      }}
      className="w-14 text-center tabular-nums text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] py-1 px-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed"
    />
  );
}

export default function PersonCard({ person, rows, projects, projectToCc = {}, cap, onChange, onDeleteRow, onSave, saving, forceCollapsed, monthRows, monthLoading }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (forceCollapsed) setCollapsed(forceCollapsed === 'collapse');
  }, [forceCollapsed]);

  const status = calcStatus(rows, cap);
  const totalF = rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
  const totalC = rows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
  const canReplicate = rows.some(r => Number(r.hours_forecast) > 0);

  function addRow() {
    onChange([...rows, { id: uid(), project: '', businessUnit: '', hours_forecast: '', hours_consolidated: '' }]);
  }

  function removeRow(row) {
    onDeleteRow(row); // deleta no ClickUp + atualiza estado no pai
  }

  function updateRow(id, field, value) {
    onChange(rows.map(r => {
      if (r.id !== id) return r;
      if (field === 'hours_forecast') {
        if (value === '') return { ...r, hours_forecast: '' };
        let n = Math.max(0, Math.min(99, parseInt(value, 10) || 0));
        const otherTotal = rows.filter(x => x.id !== id).reduce((s, x) => s + (Number(x.hours_forecast) || 0), 0);
        if (otherTotal + n > cap) n = Math.max(0, cap - otherTotal);
        return { ...r, hours_forecast: n };
      }
      if (field === 'hours_consolidated') {
        if (value === '') return { ...r, hours_consolidated: '' };
        return { ...r, hours_consolidated: Math.max(0, Math.min(99, parseInt(value, 10) || 0)) };
      }
      const next = { ...r, [field]: value };
      if (field === 'project' && value && projectToCc[value]) {
        next.businessUnit = projectToCc[value];
      }
      return next;
    }));
  }

  function replicateAll() {
    onChange(rows.map(r => ({ ...r, hours_consolidated: r.hours_forecast })));
  }

  function replicateRow(id) {
    onChange(rows.map(r => r.id === id ? { ...r, hours_consolidated: r.hours_forecast } : r));
  }

  return (
    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 bg-[var(--surface)]">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-[var(--text-secondary)] text-xs w-5 shrink-0"
          aria-label={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? '▶' : '▼'}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px] text-[var(--text-primary)] truncate">{person.name}</span>
            {person.unidade && (
              <span className="text-xs text-[var(--text-secondary)] shrink-0">{person.unidade}</span>
            )}
          </div>
          <StatusBar totalF={totalF} totalC={totalC} cap={cap} />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Totais */}
          <span className="tabular-nums text-sm text-[var(--text-secondary)] hidden sm:inline">
            {totalF}h prev · {totalC}h real
          </span>
          <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">/ {cap}h</span>

          {/* Status badge */}
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
            {status.label}
          </span>

          {/* Replicar tudo */}
          {canReplicate && (
            <button
              onClick={replicateAll}
              title="Replicar todas as previstas → realizadas"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
            >↺</button>
          )}

          {/* Salvar */}
          <button
            onClick={onSave}
            disabled={saving}
            className="text-xs px-3 py-1 rounded-full bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? '…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Rows */}
      {!collapsed && (
        <div className="border-t border-[var(--border-subtle)]">
          {/* Desktop header */}
          <div className="hidden sm:grid grid-cols-[10px_1fr_140px_64px_64px_48px_32px] gap-2 px-4 py-1.5 text-[11px] uppercase tracking-wide text-[var(--text-secondary)] bg-[var(--surface-raised)] border-b border-[var(--border-subtle)]">
            <span />
            <span>Projeto</span>
            <span>Centro de Custo</span>
            <span className="text-center">Prev.</span>
            <span className="text-center">Real.</span>
            <span className="text-center">Desv.</span>
            <span />
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {rows.map(r => {
              const desvio = (Number(r.hours_consolidated) || 0) - (Number(r.hours_forecast) || 0);
              const desvioColor = desvio === 0 ? 'text-[var(--text-secondary)]' : desvio > 0 ? 'text-[var(--positive-text)]' : 'text-[var(--negative-text)]';
              const replicable = Number(r.hours_forecast) > 0 && !r.hours_consolidated;

              return (
                <div key={r.id}>
                  {/* Desktop row */}
                  <div className="hidden sm:grid grid-cols-[10px_1fr_140px_64px_64px_48px_32px] gap-2 items-center px-4 py-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: r.businessUnit ? ccColor(r.businessUnit) : 'var(--border)' }} />
                    <Combobox
                      value={r.project}
                      onChange={v => updateRow(r.id, 'project', v)}
                      options={projects}
                      placeholder="Projeto…"
                      className="w-full text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] py-1 px-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                    <select
                      value={r.businessUnit}
                      onChange={e => updateRow(r.id, 'businessUnit', e.target.value)}
                      className="text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] py-1 px-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                      <option value="">CC…</option>
                      {CENTRO_DE_CUSTO_OPTIONS.map(o => (
                        <option key={o.id} value={o.name}>{o.name}</option>
                      ))}
                    </select>
                    <HoursInput value={r.hours_forecast}    onChange={v => updateRow(r.id, 'hours_forecast', v)} />
                    <HoursInput value={r.hours_consolidated} onChange={v => updateRow(r.id, 'hours_consolidated', v)} />
                    <div className="flex items-center justify-center gap-1">
                      <span className={`tabular-nums text-sm font-medium ${desvioColor}`}>
                        {desvio !== 0 ? (desvio > 0 ? `+${desvio}` : `${desvio}`) : '—'}
                      </span>
                      {replicable && (
                        <button
                          onClick={() => replicateRow(r.id)}
                          title="Replicar previstas → realizadas"
                          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)]"
                        >↺</button>
                      )}
                    </div>
                    <button
                      onClick={() => removeRow(r)}
                      title={rows.length === 1 ? 'Limpar linha' : 'Remover linha'}
                      className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--negative-text)] hover:bg-[var(--negative-soft)] transition-colors"
                    >×</button>
                  </div>

                  {/* Mobile card */}
                  <div className="sm:hidden p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: r.businessUnit ? ccColor(r.businessUnit) : 'var(--border)' }} />
                      <Combobox
                        value={r.project}
                        onChange={v => updateRow(r.id, 'project', v)}
                        options={projects}
                        placeholder="Projeto…"
                        className="flex-1 text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] py-2 px-3 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={r.businessUnit}
                        onChange={e => updateRow(r.id, 'businessUnit', e.target.value)}
                        className="flex-1 text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] py-2 px-2"
                      >
                        <option value="">CC…</option>
                        {CENTRO_DE_CUSTO_OPTIONS.map(o => (
                          <option key={o.id} value={o.name}>{o.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--text-secondary)]">Prev</span>
                        <HoursInput value={r.hours_forecast} onChange={v => updateRow(r.id, 'hours_forecast', v)} />
                        <span className="text-xs text-[var(--text-secondary)]">Real</span>
                        <HoursInput value={r.hours_consolidated} onChange={v => updateRow(r.id, 'hours_consolidated', v)} />
                      </div>
                      {replicable && (
                        <button onClick={() => replicateRow(r.id)} className="text-[var(--text-secondary)] hover:text-[var(--accent)]">↺</button>
                      )}
                      <button
                        onClick={() => removeRow(r)}
                        title={rows.length === 1 ? 'Limpar linha' : 'Remover linha'}
                        className="text-[var(--text-secondary)] hover:text-[var(--negative-text)]"
                      >×</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add row */}
          <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
            <button
              onClick={addRow}
              className="text-xs text-[var(--accent)] hover:underline"
            >+ Adicionar projeto</button>
          </div>

          <MonthAccumulated monthRows={monthRows} monthLoading={monthLoading} />
        </div>
      )}
    </div>
  );
}
