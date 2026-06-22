import { useState, useEffect, useCallback } from 'react';
import { getISOWeek } from 'date-fns';
import { people as cuPeople } from '../lib/clickup/lists.js';
import WeekNav from './components/WeekNav.jsx';
import UnidadeFilter from './components/UnidadeFilter.jsx';
import Alocar from './screens/Alocar.jsx';
import VerAlocacao from './screens/VerAlocacao.jsx';
import DashboardHistorico from './screens/DashboardHistorico.jsx';

const TABS = [
  { id: 'alocar',     label: 'Alocar' },
  { id: 'ver',        label: 'Ver Alocação' },
  { id: 'dashboard',  label: 'Dashboard' },
];

const PEOPLE_CACHE_KEY = 'ts:cache:people:v2';
const CACHE_TTL = 5 * 60 * 1000;

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}

function isCacheFresh(cached) {
  return cached?.savedAt && (Date.now() - cached.savedAt) < CACHE_TTL;
}

export default function AppV2() {
  const today = new Date();
  const [tab, setTab]         = useState('alocar');
  const [year, setYear]       = useState(today.getFullYear());
  const [week, setWeek]       = useState(getISOWeek(today));
  const [unidade, setUnidade] = useState(null); // null = todas
  const [people, setPeople]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Carrega pessoas com unidade (com cache)
  const loadPeople = useCallback(async () => {
    const cached = safeJsonParse(localStorage.getItem(PEOPLE_CACHE_KEY), null);
    if (isCacheFresh(cached) && Array.isArray(cached.data)) {
      setPeople(cached.data);
      setLoading(false);
      return;
    }
    try {
      const data = await cuPeople.loadAllWithMeta();
      setPeople(data);
      localStorage.setItem(PEOPLE_CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
    } catch (e) {
      console.error('Erro ao carregar pessoas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  // Unidades disponíveis (sem nulos, sem duplicatas, ordenadas)
  const unidades = [...new Set(people.map(p => p.unidade).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  // Pessoas filtradas pela unidade selecionada
  const filteredPeople = unidade
    ? people.filter(p => p.unidade === unidade)
    : people;

  function handleNavigate(y, w) {
    setYear(y);
    setWeek(w);
  }

  const showWeekNav    = tab !== 'dashboard';
  const showUnidade    = unidades.length > 0;

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] text-[var(--text-primary)]"
      style={{ fontFamily: 'Geist, ui-sans-serif, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-[var(--accent)]">SAL</span>
              <span className="text-[var(--text-secondary)] text-sm">Alocações v2</span>
            </div>

            {/* Tabs — desktop */}
            <nav className="hidden sm:flex gap-1">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    tab === t.id
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {loading && (
              <span className="text-xs text-[var(--text-secondary)] animate-pulse">carregando…</span>
            )}
          </div>
        </div>
      </header>

      {/* Controls bar */}
      {(showWeekNav || showUnidade) && (
        <div className="bg-[var(--surface)] border-b border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            {showWeekNav && <WeekNav year={year} week={week} onNavigate={handleNavigate} />}
            {showUnidade && (
              <UnidadeFilter unidades={unidades} value={unidade} onChange={setUnidade} />
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto">
        {tab === 'alocar' && (
          <Alocar
            people={filteredPeople}
            year={year}
            week={week}
            onNavigate={handleNavigate}
          />
        )}
        {tab === 'ver' && (
          <VerAlocacao
            people={filteredPeople}
            year={year}
            week={week}
            onNavigate={handleNavigate}
          />
        )}
        {tab === 'dashboard' && (
          <DashboardHistorico
            people={filteredPeople}
            year={year}
            week={week}
          />
        )}
      </main>

      {/* Bottom nav — mobile */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-[var(--surface)] border-t border-[var(--border)] flex pb-[env(safe-area-inset-bottom)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
