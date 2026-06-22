import { useState, useEffect, useMemo, useCallback } from 'react';
import { getISOWeek } from 'date-fns';
import Dashboard from '../../Dashboard.jsx';
import { loadLastYear } from '../../lib/clickup/entries.js';
import { projects as cuProjects } from '../../lib/clickup/lists.js';

const DB_CACHE_KEY  = 'ts:cache:db:dashboard:v2';
const META_CACHE_KEY = 'ts:cache:projectMeta:v1'; // compartilhado com V1
const CACHE_TTL = 5 * 60 * 1000;

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}
function isCacheFresh(c) { return c?.savedAt && (Date.now() - c.savedAt) < CACHE_TTL; }

// ── Records browser simples ──────────────────────────────────────────────────
function RecordsSimples({ db }) {
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField]   = useState('ISO_Week');
  const [sortDir, setSortDir]       = useState('desc');
  const [page, setPage]             = useState(0);
  const PAGE_SIZE = 100;

  function normalize(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  const filtered = useMemo(() => {
    let rows = db || [];
    if (filterText) {
      const q = normalize(filterText);
      rows = rows.filter(r =>
        normalize(r.Person).includes(q) ||
        normalize(r.Project).includes(q) ||
        normalize(r.Business_Unit).includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const va = a[sortField], vb = b[sortField];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'pt-BR')
        : String(vb).localeCompare(String(va), 'pt-BR');
    });
  }, [db, filterText, sortField, sortDir]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  }

  const th = (field, label) => (
    <th
      key={field}
      onClick={() => toggleSort(field)}
      className="px-3 py-2 text-left text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide cursor-pointer hover:text-[var(--text-primary)] whitespace-nowrap select-none"
    >
      {label} {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-1">
        <input
          value={filterText}
          onChange={e => { setFilterText(e.target.value); setPage(0); }}
          placeholder="Filtrar por pessoa, projeto ou CC…"
          className="flex-1 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <span className="text-xs text-[var(--text-secondary)] shrink-0">
          {filtered.length.toLocaleString('pt-BR')} registros
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-raised)]">
            <tr>
              {th('Year',              'Ano')}
              {th('ISO_Week',          'Sem.')}
              {th('Person',            'Pessoa')}
              {th('Project',           'Projeto')}
              {th('Business_Unit',     'CC')}
              {th('Hours_Forecast',    'Prev.')}
              {th('Hours_Consolidated','Real.')}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {paged.map((r, i) => {
              const desvio = (Number(r.Hours_Consolidated) || 0) - (Number(r.Hours_Forecast) || 0);
              return (
                <tr key={r.ID || i} className="hover:bg-[var(--surface-raised)]">
                  <td className="px-3 py-2 tabular-nums text-[var(--text-secondary)]">{r.Year}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{String(r.ISO_Week).padStart(2,'0')}</td>
                  <td className="px-3 py-2 truncate max-w-[140px]">{r.Person}</td>
                  <td className="px-3 py-2 truncate max-w-[200px]">{r.Project}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{r.Business_Unit}</td>
                  <td className="px-3 py-2 tabular-nums text-center">{r.Hours_Forecast ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-center">
                    {r.Hours_Consolidated != null ? (
                      <span className={desvio < 0 ? 'text-[var(--negative-text)]' : desvio > 0 ? 'text-[var(--positive-text)]' : ''}>
                        {r.Hours_Consolidated}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
            {!paged.length && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-[var(--text-secondary)]">Sem resultados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded border border-[var(--border)] disabled:opacity-30">‹</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded border border-[var(--border)] disabled:opacity-30">›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardHistorico({ people, year, week }) {
  const [db, setDb]                   = useState(null);   // null = não carregado ainda
  const [projectMeta, setProjectMeta] = useState({});
  const [loading, setLoading]         = useState(false);
  const [progress, setProgress]       = useState(0);

  const peopleNames = useMemo(() => people.map(p => p.name), [people]);

  // Tenta carregar do cache na montagem
  useEffect(() => {
    const cached = safeJsonParse(localStorage.getItem(DB_CACHE_KEY), null);
    if (isCacheFresh(cached) && Array.isArray(cached.data)) setDb(cached.data);

    const metaCached = safeJsonParse(localStorage.getItem(META_CACHE_KEY), null);
    if (metaCached?.data) setProjectMeta(metaCached.data);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setProgress(0);
    try {
      const [rows, projsMeta] = await Promise.all([
        loadLastYear(year, { onProgress: n => setProgress(n) }),
        cuProjects.loadAllWithMeta(),
      ]);

      const meta = {};
      for (const p of projsMeta) meta[p.name] = p;
      setProjectMeta(meta);
      setDb(rows);

      localStorage.setItem(DB_CACHE_KEY,  JSON.stringify({ data: rows, savedAt: Date.now() }));
      localStorage.setItem(META_CACHE_KEY, JSON.stringify({ data: meta, savedAt: Date.now() }));
    } catch (e) {
      console.error('[DashboardHistorico] loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [year]);

  // Tela de carregamento / botão inicial
  if (db === null) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        {loading ? (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            <p className="text-sm text-[var(--text-secondary)]">
              Carregando histórico… {progress > 0 ? `${progress} registros` : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-[var(--text-secondary)] text-sm">O histórico completo não foi carregado ainda.</p>
            <button
              onClick={loadData}
              className="px-5 py-2 rounded-full bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Carregar histórico
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 pb-20">
      <Dashboard
        db={db}
        projectMeta={projectMeta}
        people={peopleNames}
        person=""
        selectedWeek={week}
        selectedYear={year}
        onRefresh={loadData}
        loadingHistory={loading}
        recordsContent={<RecordsSimples db={db} />}
      />
    </div>
  );
}
