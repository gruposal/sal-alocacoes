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
  // Mesma chave "theme" da v1 — troca o tema em uma aba reflete na outra.
  const [theme, setTheme]     = useState(() => {
    const s = localStorage.getItem('theme');
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
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

  useEffect(() => {
    const root = document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

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
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--text-1)]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--canvas)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <span className="font-display-italic text-[17px] tracking-[-0.01em] shrink-0 text-[var(--text-1)] after:content-[''] after:inline-block after:w-[5px] after:h-[5px] after:bg-[var(--accent)] after:rounded-full after:ml-[5px] after:translate-y-[-2px] after:align-middle">
            Grupo SAL · Alocações
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-[var(--text-3)] border border-[var(--border-subtle)] rounded-full px-1.5 py-0.5">v2</span>

          {/* Tabs — desktop, underline style */}
          <nav className="hidden sm:flex mx-auto gap-1">
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`relative px-4 py-3 text-[13.5px] font-medium transition-colors ${
                    active ? 'text-[var(--text-1)]' : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
                  }`}>
                  {t.label}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-[var(--accent)] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {loading && (
              <span className="text-xs text-[var(--text-2)] animate-pulse">carregando…</span>
            )}
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-alt)] transition-colors text-[14px]">
              {theme === 'dark' ? '☀' : '◑'}
            </button>
          </div>
        </div>
      </header>

      {/* Controls bar */}
      {(showWeekNav || showUnidade) && (
        <div className="bg-[var(--surface)] border-b border-[var(--border-subtle)]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {showWeekNav && <WeekNav year={year} week={week} onNavigate={handleNavigate} />}
              {showWeekNav && (
                <button
                  onClick={() => setReloadKey(k => k + 1)}
                  title="Recarregar dados da semana"
                  className="text-xs text-[var(--text-2)] hover:text-[var(--accent)] transition-colors px-1"
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
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] flex pb-[env(safe-area-inset-bottom)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors ${
              tab === t.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-3)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
