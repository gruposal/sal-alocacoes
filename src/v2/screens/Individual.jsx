import { useState, useEffect, useCallback, useRef } from 'react';
import { loadForWeek, loadForPersonWeek, upsertConsolidated } from '../../lib/clickup/entries.js';
import { getWeekCap } from '../lib/feriados.js';
import { ccColor } from '../../lib/clickup/fields.js';
import Combobox from '../components/Combobox.jsx';

const PERSON_KEY = 'ts:v2:individual:person';

function StatusBar({ totalF, totalC, cap }) {
  const pctF = Math.min(100, cap > 0 ? Math.round((totalF / cap) * 100) : 0);
  const pctC = Math.min(100, cap > 0 ? Math.round((totalC / cap) * 100) : 0);
  const over = totalF > cap;
  const barColor = over
    ? 'var(--negative)'
    : totalC >= totalF && totalF > 0 ? 'var(--positive)'
    : totalF > 0 ? 'var(--accent)'
    : 'var(--border-subtle)';
  return (
    <div className="w-full h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden relative">
      <div className="h-full rounded-full transition-all absolute top-0 left-0"
        style={{ width: `${pctF}%`, background: barColor }} />
      {pctC > 0 && pctC < pctF && (
        <div className="h-full rounded-full transition-all absolute top-0 left-0 bg-[var(--positive)]"
          style={{ width: `${pctC}%` }} />
      )}
    </div>
  );
}

function calcStatus(rows, cap) {
  const f = rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
  const c = rows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
  if (!f && !c) return { type: 'vazio',    label: 'sem alocação', cls: 'text-[var(--text-2)] bg-[var(--surface-alt)] border border-[var(--border-subtle)]' };
  if (f > cap)  return { type: 'excedido', label: `excedido · ${f}h`, cls: 'text-[var(--negative-text)] bg-[var(--negative-soft)]' };
  if (c === 0)  return { type: 'pendente', label: `pendente · 0/${f}h`, cls: 'text-[var(--warning-text)] bg-[var(--warning-soft)]' };
  if (c >= f)   return { type: 'fechado',  label: `fechado · ${c}h`, cls: 'text-[var(--positive-text)] bg-[var(--positive-soft)]' };
  return        { type: 'parcial',         label: `parcial · ${c}/${f}h`, cls: 'text-[var(--info-text)] bg-[var(--info-soft)]' };
}

function HoursInput({ value, onChange }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'PageUp')   { e.preventDefault(); onChange(Math.min(99, (Number(value) || 0) + 4)); }
        if (e.key === 'PageDown') { e.preventDefault(); onChange(Math.max(0,  (Number(value) || 0) - 4)); }
      }}
      className="w-16 text-center tabular-nums text-base rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-1)] py-2 px-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
    />
  );
}

export default function Individual({ people, year, week }) {
  const cap = getWeekCap(year, week);
  const [selectedPerson, setSelectedPerson] = useState(
    () => localStorage.getItem(PERSON_KEY) || ''
  );
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  const weekRef = useRef({ year, week });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function selectPerson(name) {
    setSelectedPerson(name);
    if (name) localStorage.setItem(PERSON_KEY, name);
    else localStorage.removeItem(PERSON_KEY);
  }

  const loadData = useCallback(async (yr, wk, name, personId) => {
    if (!name) return;
    weekRef.current = { year: yr, week: wk };
    setLoading(true);
    setRows([]);
    try {
      // Filtra direto na API pela pessoa (evita baixar as horas de todo mundo).
      // Sem personId resolvido, cai no fallback antigo (busca tudo e filtra no cliente).
      const rawRows = personId
        ? await loadForPersonWeek(yr, wk, personId)
        : (await loadForWeek(yr, wk)).filter(r => r.Person === name);
      if (weekRef.current.year !== yr || weekRef.current.week !== wk) return;
      const mine = rawRows.filter(r => r.Person === name);
      setRows(mine.map(r => ({
        _taskId: r._taskId ?? null,
        project: r.Project,
        businessUnit: r.Business_Unit || '',
        hours_forecast: Number(r.Hours_Forecast) || 0,
        hours_consolidated: r.Hours_Consolidated != null ? Number(r.Hours_Consolidated) : '',
      })));
    } catch (e) {
      console.error('[Individual] loadData error:', e);
      showToast('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedPersonId = people.find(p => p.name === selectedPerson)?.id ?? null;

  useEffect(() => {
    loadData(year, week, selectedPerson, selectedPersonId);
  }, [year, week, selectedPerson, selectedPersonId, loadData]);

  function updateConsolidated(idx, value) {
    setRows(prev => prev.map((r, i) => i !== idx ? r : {
      ...r,
      hours_consolidated: value === '' ? '' : Math.max(0, Math.min(99, parseInt(value, 10) || 0)),
    }));
  }

  function replicateRow(idx) {
    setRows(prev => prev.map((r, i) => i !== idx ? r : {
      ...r,
      hours_consolidated: r.hours_forecast,
    }));
  }

  function replicateAll() {
    setRows(prev => prev.map(r => ({ ...r, hours_consolidated: r.hours_forecast })));
  }

  async function save() {
    if (saving) return;
    const toSave = rows.filter(r => r.project && Number(r.hours_consolidated) >= 0 && r.hours_consolidated !== '');
    if (!toSave.length) { showToast('Preencha pelo menos um campo de realizado.'); return; }

    setSaving(true);
    try {
      const payload = toSave.map(r => ({
        Year: year, ISO_Week: week,
        Person: selectedPerson, Project: r.project,
        Business_Unit: r.businessUnit,
        Hours_Forecast: r.hours_forecast || null,
        Hours_Consolidated: Number(r.hours_consolidated),
      }));
      await upsertConsolidated(payload);
      showToast(`Realizadas salvas — ${toSave.length} linha${toSave.length > 1 ? 's' : ''}.`);
    } catch (e) {
      console.error('[Individual] save error:', e);
      showToast(`Erro ao salvar: ${e.message || 'verifique o console'}`);
    } finally {
      setSaving(false);
    }
  }

  const personNames = people.map(p => p.name).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const totalF = rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
  const totalC = rows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
  const status = calcStatus(rows, cap);
  const canReplicate = rows.some(r => r.hours_forecast > 0);

  if (!people.length) {
    return (
      <div className="p-8 text-center text-[var(--text-2)]">
        <p className="text-sm">Aguarde o carregamento das pessoas…</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Seletor de pessoa */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 space-y-1">
        <label className="text-xs uppercase tracking-wide text-[var(--text-2)] font-medium">
          Colaborador
        </label>
        <Combobox
          value={selectedPerson}
          onChange={selectPerson}
          options={personNames}
          placeholder="Selecione seu nome…"
          className="w-full text-base rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-1)] py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {selectedPerson && !loading && rows.length > 0 && (
        <>
          {/* Status + barra */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-1)]">{selectedPerson}</span>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
                {status.label}
              </span>
            </div>
            <StatusBar totalF={totalF} totalC={totalC} cap={cap} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-2)]">
                {totalC}h realizadas de {totalF}h previstas
              </span>
              {canReplicate && (
                <button
                  onClick={replicateAll}
                  className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  ↺ Replicar tudo
                </button>
              )}
            </div>
          </div>

          {/* Linhas por projeto */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-[var(--text-2)] font-medium">
                Projetos da semana
              </span>
              <span className="text-xs text-[var(--text-2)] tabular-nums">
                W{week} · {cap}h/semana
              </span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {rows.map((r, idx) => {
                const replicable = r.hours_forecast > 0 && (r.hours_consolidated === '' || Number(r.hours_consolidated) !== r.hours_forecast);
                const desvio = (Number(r.hours_consolidated) || 0) - r.hours_forecast;
                return (
                  <div key={idx} className="px-4 py-3">
                    {/* Projeto + CC */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-2 h-2 rounded-full shrink-0 mt-0.5"
                        style={{ background: ccColor(r.businessUnit) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-1)] leading-snug">{r.project}</p>
                        {r.businessUnit && (
                          <p className="text-xs text-[var(--text-2)]">{r.businessUnit}</p>
                        )}
                      </div>
                    </div>

                    {/* Horas */}
                    <div className="flex items-center gap-3">
                      {/* Previstas (readonly) */}
                      <div className="flex-1 rounded-lg bg-[var(--surface-alt)] border border-[var(--border-subtle)] px-3 py-2 text-center">
                        <div className="text-xs text-[var(--text-2)] mb-0.5">Previstas</div>
                        <div className="tabular-nums text-sm font-medium text-[var(--text-2)]">{r.hours_forecast}h</div>
                      </div>

                      {/* Realizadas (editável) */}
                      <div className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="text-xs text-[var(--text-2)]">Realizadas</div>
                        <HoursInput
                          value={r.hours_consolidated}
                          onChange={v => updateConsolidated(idx, v)}
                        />
                      </div>

                      {/* Desvio + replicar */}
                      <div className="flex flex-col items-end gap-1 min-w-[48px]">
                        {r.hours_consolidated !== '' && desvio !== 0 && (
                          <span className={`text-xs font-medium tabular-nums ${desvio > 0 ? 'text-[var(--positive-text)]' : 'text-[var(--negative-text)]'}`}>
                            {desvio > 0 ? `+${desvio}` : desvio}h
                          </span>
                        )}
                        {replicable && (
                          <button
                            onClick={() => replicateRow(idx)}
                            title="Replicar previstas → realizadas"
                            className="text-sm text-[var(--text-2)] hover:text-[var(--accent)] transition-colors"
                          >↺</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Salvar */}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar realizadas'}
          </button>
        </>
      )}

      {selectedPerson && loading && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center">
          <p className="text-sm text-[var(--text-2)] animate-pulse">Carregando…</p>
        </div>
      )}

      {selectedPerson && !loading && rows.length === 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-6 text-center space-y-1">
          <p className="text-sm text-[var(--text-1)] font-medium">Sem alocações nesta semana</p>
          <p className="text-xs text-[var(--text-2)]">Peça para seu gestor lançar as previstas primeiro.</p>
        </div>
      )}

      {!selectedPerson && (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center space-y-1">
          <p className="text-sm text-[var(--text-2)]">Selecione seu nome acima para ver e confirmar suas horas realizadas.</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[var(--text-1)] text-[var(--canvas)] text-sm font-medium shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
