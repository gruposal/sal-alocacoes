import { useState, useEffect, useCallback, useRef } from 'react';
import { getISOWeek } from 'date-fns';
import { people as cuPeople } from '../lib/clickup/lists.js';
import WeekNav from './components/WeekNav.jsx';
import UnidadeFilter from './components/UnidadeFilter.jsx';
import Alocar from './screens/Alocar.jsx';
import DashboardHistorico from './screens/DashboardHistorico.jsx';
import Individual from './screens/Individual.jsx';

const TABS = [
  { id: 'alocar',      label: 'Alocação' },
  { id: 'individual',  label: 'Minha Semana' },
  { id: 'dashboard',   label: 'Dashboard' },
];

const PEOPLE_CACHE_KEY = 'ts:cache:people:v2';
const CACHE_TTL = 5 * 60 * 1000;

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}

function isCacheFresh(cached) {
  return cached?.savedAt && (Date.now() - cached.savedAt) < CACHE_TTL;
}

// Slug curto pra compartilhar: "Novos Negócios" → "novos-negocios".
function slugify(str) {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Lê o slug de unidade de "/comunicacao" ou "/v2/comunicacao" (não de "/v2" sozinho).
function slugFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === 'v2') return parts[1] || null;
  if (parts.length === 1) return parts[0];
  return null;
}

export default function AppV2() {
  const today = new Date();
  const [tab, setTab]         = useState('alocar');
  const [year, setYear]       = useState(today.getFullYear());
  const [week, setWeek]       = useState(getISOWeek(today));
  const [unidade, setUnidade] = useState(() => new URLSearchParams(window.location.search).get('unidade') || null);
  const [people, setPeople]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  // Slug pendente vindo de um link curto (ex: /comunicacao) — resolvido assim que as unidades carregarem.
  const pendingSlugRef = useRef(unidade ? null : slugFromPath(window.location.pathname));

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

  // CSC é 100% overhead — não aloca horas, então some do filtro e da lista de pessoas.
  const alocaveis = people.filter(p => p.unidade !== 'CSC');

  // Unidades disponíveis (sem nulos, sem duplicatas, ordenadas)
  const unidades = [...new Set(alocaveis.map(p => p.unidade).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  // Resolve um slug pendente (de um link curto tipo /comunicacao) contra a lista real de unidades.
  useEffect(() => {
    if (!pendingSlugRef.current || unidade || !unidades.length) return;
    const match = unidades.find(u => slugify(u) === pendingSlugRef.current);
    pendingSlugRef.current = null;
    if (match) setUnidade(match);
  }, [unidades, unidade]);

  // Sincroniza a unidade selecionada com a URL (link curto /slug), para permitir links diretos por unidade.
  useEffect(() => {
    if (pendingSlugRef.current) return; // aguarda a resolução do slug antes de reescrever a URL
    const path = unidade ? `/${slugify(unidade)}` : '/v2';
    if (window.location.pathname !== path || window.location.search) {
      window.history.replaceState(null, '', path);
    }
  }, [unidade]);

  // Pessoas filtradas pela unidade selecionada
  const filteredPeople = unidade
    ? alocaveis.filter(p => p.unidade === unidade)
    : alocaveis;

  function handleNavigate(y, w) {
    setYear(y);
    setWeek(w);
  }

  const showWeekNav    = tab !== 'dashboard';
  const showUnidade    = unidades.length > 0 && tab !== 'individual';

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
            <div className="flex items-center gap-3">
              {showWeekNav && <WeekNav year={year} week={week} onNavigate={handleNavigate} />}
              {showWeekNav && (
                <button
                  onClick={() => setReloadKey(k => k + 1)}
                  title="Recarregar dados da semana"
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors px-1"
                >
                  ↻
                </button>
              )}
            </div>
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
            key={reloadKey}
            people={filteredPeople}
            year={year}
            week={week}
            onNavigate={handleNavigate}
          />
        )}
        {tab === 'individual' && (
          <Individual
            key={reloadKey}
            people={alocaveis}
            year={year}
            week={week}
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
