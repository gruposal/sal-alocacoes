import React, { useEffect, useMemo, useRef, useState } from "react";
import { format, getISOWeek, startOfISOWeek, endOfISOWeek, setISOWeek, setYear } from "date-fns";
import Dashboard from "./Dashboard.jsx";
import Directory from "./Directory.jsx";
import { loadForWeek, loadLastYear, upsertForecast, upsertConsolidated, deleteRow as cuDeleteRow } from "./lib/clickup/entries.js";
import { people as cuPeople, projects as cuProjects } from "./lib/clickup/lists.js";
import { CENTRO_DE_CUSTO_OPTIONS, ccColor } from "./lib/clickup/fields.js";
import "./lib/hoursLogic.js"; // side-effect: roda self-tests no load

const DEFAULT_BUS = CENTRO_DE_CUSTO_OPTIONS.map(o => o.name);
const toTwo = (n) => String(n).padStart(2, "0");

// Formato "18 – 22 de maio" (pt-BR). Reduz para "29 dez – 2 jan" se cruza mês.
function formatWeekRangePt(start, end) {
  const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
  const sMonth = monthFmt.format(start);
  const eMonth = monthFmt.format(end);
  if (sMonth === eMonth) {
    return `${dayFmt.format(start)} – ${dayFmt.format(end)} de ${sMonth}`;
  }
  return `${dayFmt.format(start)} de ${sMonth.slice(0, 3)} – ${dayFmt.format(end)} de ${eMonth.slice(0, 3)}`;
}
const uid = () => Math.random().toString(36).slice(2, 10);
const PERSIST_KEY = "ts:cu:v1";

function safeJsonParse(t, fb) { try { return JSON.parse(t); } catch { return fb; } }

// ─── Cache em localStorage (stale-while-revalidate) ─────────────────────────
const CACHE_VERSION = 'v1';
const CACHE_FRESH_MS = 5 * 60 * 1000; // 5 min — abaixo disso, pula refresh em background

function cacheKey(kind, scope = '') {
  return `ts:cache:${kind}${scope ? ':' + scope : ''}:${CACHE_VERSION}`;
}

function readCache(kind, scope = '') {
  try {
    const raw = typeof window === 'undefined' ? null : localStorage.getItem(cacheKey(kind, scope));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || typeof obj.savedAt !== 'number') return null;
    return obj;
  } catch { return null; }
}

function writeCache(kind, payload, scope = '') {
  try {
    localStorage.setItem(cacheKey(kind, scope), JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch (e) {
    console.warn('writeCache failed:', e?.message);
  }
}

function isCacheFresh(cached) {
  if (!cached?.savedAt) return false;
  return Date.now() - cached.savedAt < CACHE_FRESH_MS;
}
function weekStartEnd(year, isoWeek) {
  const d = setISOWeek(setYear(new Date(), year), isoWeek);
  return { start: startOfISOWeek(d), end: endOfISOWeek(d) };
}

// Funções puras de horas (sumWeek, allowedAfterCap) ficam em ./lib/hoursLogic.js
// para não quebrar o Fast Refresh deste módulo. Importe de lá se precisar.

// Normaliza para comparação: remove acentos + lowercase.
// Mesma lógica de src/lib/clickup/entries.js — garante que "Edilson Junior" encontra "Edilson Júnior".
function normalizeMatch(s) {
  return (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// ─── Combobox ────────────────────────────────────────────────────────────────
function Combobox({ value, onChange, options, placeholder, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value ?? "");
  const [rect, setRect] = useState(null);
  const [highlight, setHighlight] = useState(0);   // índice do item destacado p/ teclado
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => { setQuery(value ?? ""); }, [value]);

  // Reposiciona dropdown quando a página rola, MAS sem fechar se o scroll for dentro da própria lista.
  useEffect(() => {
    if (!open) return;
    const onScroll = (e) => {
      // Scroll de dentro do dropdown → ignora (deixa a lista rolar normalmente)
      if (listRef.current && listRef.current.contains(e.target)) return;
      // Scroll da página → reposiciona o dropdown para acompanhar o input
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  // Dedupa opções (a Lista de Projetos pode ter nomes repetidos, ex: "Gestão CSC" 2x).
  const uniqueOptions = useMemo(() => {
    const seen = new Set();
    return options.filter(o => {
      const k = normalizeMatch(o);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [options]);

  const filtered = useMemo(() => {
    const q = normalizeMatch(query);
    if (!q) return uniqueOptions;
    return uniqueOptions.filter(o => normalizeMatch(o).includes(q));
  }, [query, uniqueOptions]);

  // Reseta highlight pro topo quando lista muda; mantém na opção atual se houver
  useEffect(() => {
    if (!open) return;
    const cur = filtered.findIndex(o => o === value);
    setHighlight(cur >= 0 ? cur : 0);
  }, [open, filtered, value]);

  // Auto-scroll do item destacado pra dentro do viewport
  useEffect(() => {
    if (!open) return;
    const el = itemRefs.current[highlight];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, open]);

  function openDropdown() {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    setOpen(true);
  }

  function select(opt) { setQuery(opt); onChange(opt); setOpen(false); }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { openDropdown(); return; }
      setHighlight(h => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { openDropdown(); return; }
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault();
        select(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); }
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setHighlight(filtered.length - 1);
    }
  }

  function handleBlur(e) {
    if (listRef.current?.contains(e.relatedTarget)) return;
    // Match insensível a acentos: "Edilson Junior" casa com "Edilson Júnior" e usa o nome canônico da Lista.
    const q = normalizeMatch(query);
    const match = options.find(o => normalizeMatch(o) === q);
    if (match) { onChange(match); setQuery(match); }
    else { setQuery(value ?? ""); }
    setOpen(false);
  }

  const dropStyle = useMemo(() => {
    if (!rect) return {};
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Dropdown grande quando há espaço — facilita escanear listas longas (60+ projetos)
    const maxH = Math.min(360, Math.max(spaceBelow, spaceAbove) - 16);
    const top = spaceBelow >= maxH + 8 ? rect.bottom + 4 : rect.top - maxH - 4;
    const isMobile = window.innerWidth < 640;
    return isMobile
      ? { position: "fixed", top, left: 12, right: 12, maxHeight: maxH, zIndex: 9999 }
      : { position: "fixed", top, left: rect.left, width: Math.max(rect.width, 320), maxHeight: maxH, zIndex: 9999 };
  }, [rect]);

  return (
    <>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); openDropdown(); }}
        onFocus={openDropdown}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls="combobox-listbox"
      />
      {open && filtered.length > 0 && rect && (
        <div
          ref={listRef}
          style={dropStyle}
          className="flex flex-col rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg text-[14px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-1.5 text-[10.5px] uppercase tracking-[0.06em] text-[var(--text-3)] border-b border-[var(--border-subtle)] bg-[var(--surface-alt)] shrink-0">
            <span>{filtered.length} {filtered.length === 1 ? 'opção' : 'opções'}</span>
            <span className="hidden sm:inline">↑↓ navegar · ⏎ selecionar · esc fechar</span>
          </div>
          <ul
            id="combobox-listbox"
            role="listbox"
            className="overflow-y-auto flex-1 overscroll-contain"
          >
            {filtered.map((opt, i) => {
              const isHighlighted = i === highlight;
              const isSelected    = opt === value;
              return (
                <li
                  key={opt}
                  ref={el => (itemRefs.current[i] = el)}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={e => { e.preventDefault(); select(opt); }}
                  onTouchEnd={e => { e.preventDefault(); select(opt); }}
                  className={[
                    'px-3 py-2 cursor-pointer border-b border-[var(--border-subtle)] last:border-0',
                    isHighlighted ? 'bg-[var(--surface-alt)]' : '',
                    isSelected ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text-1)]',
                  ].join(' ')}
                >
                  {opt}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

// ─── CcPill: bolinha colorida + nome do Centro de Custo ─────────────────────
function CcPill({ cc, compact = false }) {
  if (!cc) return <span className="text-[var(--text-3)]">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13.5px] text-[var(--text-2)] whitespace-nowrap">
      <span
        className="inline-block rounded-full shrink-0"
        style={{ width: 8, height: 8, backgroundColor: ccColor(cc) }}
        aria-hidden="true"
      />
      {compact ? null : cc}
    </span>
  );
}

// ─── WeekNav: navegação semanal média — arrows visíveis + texto centralizado + Hoje
function WeekNav({ year, week, start, end, onPrev, onNext, onToday }) {
  const t = new Date();
  const isCurrent = getISOWeek(t) === week && t.getFullYear() === year;
  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5 bg-[var(--surface-alt)] border border-[var(--border-subtle)]">
        <button onClick={onPrev} aria-label="Semana anterior"
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)] text-[18px] leading-none transition-colors">
          ‹
        </button>
        <span className="px-3 tabular-nums whitespace-nowrap text-[15px]">
          <span className="font-semibold text-[var(--text-1)]">Semana {toTwo(week)}</span>
          <span className="text-[var(--text-3)] mx-1.5">·</span>
          <span className="text-[var(--text-2)]">{formatWeekRangePt(start, end)}</span>
        </span>
        <button onClick={onNext} aria-label="Próxima semana"
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--surface)] text-[var(--text-2)] hover:text-[var(--text-1)] text-[18px] leading-none transition-colors">
          ›
        </button>
      </div>
      {!isCurrent && (
        <button onClick={onToday}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
          ↺ Hoje
        </button>
      )}
    </div>
  );
}

// ─── PersonTitle: combobox em forma de título botão grande, óbvio "clica aqui"
function PersonTitle({ value, onChange, options, loading }) {
  return (
    <div className="group inline-flex items-center gap-2.5 rounded-lg pl-3 pr-3 py-1.5 bg-[var(--surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-all cursor-pointer focus-within:bg-[var(--surface)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/15">
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        placeholder={loading ? "Carregando…" : "Selecionar colaborador…"}
        className="bg-transparent border-0 p-0 text-[22px] sm:text-[26px] font-semibold tracking-[-0.01em] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:ring-0 cursor-pointer min-w-[240px]"
      />
      <span className="text-[var(--text-2)] text-[13px] leading-none group-hover:text-[var(--text-1)] transition-colors pointer-events-none select-none">▾</span>
    </div>
  );
}

// ─── HeroHeader: título sans-bold + meta + ação à direita (ClickUp-style) ───
function HeroHeader({ title, subtitle, right, eyebrow }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.01em] text-[var(--text-1)] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 text-[13.5px] text-[var(--text-2)]">{subtitle}</div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

// ─── HoursInput: input numérico com ↑/↓ explícitos e steppers visíveis ───────
function HoursInput({ value, onChange, placeholder = '0', className = '', min = 0, max = 40, step = 1 }) {
  const inputRef = useRef(null);
  const stepBy = (delta) => {
    const cur = value === '' || value == null ? 0 : Number(value);
    const next = Math.max(min, Math.min(max, cur + delta));
    onChange(String(next));
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowUp')   { e.preventDefault(); stepBy(+step); }
    if (e.key === 'ArrowDown') { e.preventDefault(); stepBy(-step); }
    if (e.key === 'PageUp')    { e.preventDefault(); stepBy(+4); }   // bump 4h (meio dia)
    if (e.key === 'PageDown')  { e.preventDefault(); stepBy(-4); }
  };
  // Mantém o foco no input ao clicar nos botões (assim ↑↓ continua funcionando depois)
  const press = (delta) => (e) => {
    e.preventDefault();
    stepBy(delta);
    inputRef.current?.focus();
  };
  return (
    <div className="relative inline-flex items-stretch w-full">
      <input
        ref={inputRef}
        type="number" inputMode="numeric" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`${className} pr-6`}
      />
      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex flex-col opacity-60 hover:opacity-100 transition-opacity">
        <button
          type="button" tabIndex={-1}
          onMouseDown={press(+step)}
          aria-label="Aumentar"
          className="h-3 w-4 flex items-center justify-center text-[8px] leading-none text-[var(--text-3)] hover:text-[var(--accent)]"
        >▲</button>
        <button
          type="button" tabIndex={-1}
          onMouseDown={press(-step)}
          aria-label="Diminuir"
          className="h-3 w-4 flex items-center justify-center text-[8px] leading-none text-[var(--text-3)] hover:text-[var(--accent)]"
        >▼</button>
      </div>
    </div>
  );
}

// ─── WeekStatus badge ─────────────────────────────────────────────────────────
function WeekStatus({ entries }) {
  const hasForecast = entries.some(e => Number(e.hours_forecast) > 0);
  const hasConsolidated = entries.some(e => Number(e.hours_consolidated) > 0);
  if (hasConsolidated) return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-md bg-[var(--positive)]/10 text-[var(--positive)]">
      ● Consolidado
    </span>
  );
  if (hasForecast) return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-md bg-[var(--warning)]/10 text-[var(--warning)]">
      ◑ Previsão
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-0.5 rounded-md bg-[var(--surface-alt)] text-[var(--text-3)]">
      ○ Sem lançamento
    </span>
  );
}

// ─── Top progress bar (indicador global de loading) ──────────────────────────
function TopProgressBar({ visible, label }) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[10000] pointer-events-none transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden={!visible}
    >
      <div className="h-[2px] bg-[var(--accent-soft)] overflow-hidden">
        <div className="h-full w-1/3 bg-[var(--accent)] tp-indeterminate" />
      </div>
      {label && (
        <div className="absolute right-3 top-1.5 text-[10.5px] text-[var(--text-2)] bg-[var(--surface)]/95 backdrop-blur px-2 py-0.5 rounded-md border border-[var(--border-subtle)] shadow-sm pointer-events-none">
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton row (linha placeholder enquanto carrega) ───────────────────────
function SkeletonRow({ cells = 5 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 rounded bg-[var(--surface-alt)]" />
        </td>
      ))}
    </tr>
  );
}

// ─── Desvio badge ─────────────────────────────────────────────────────────────
function Desvio({ forecast, consolidated }) {
  if (consolidated == null || consolidated === "") return <span className="text-[var(--text-3)]">—</span>;
  const d = Number(consolidated) - Number(forecast);
  if (d === 0) return <span className="text-[var(--positive)] font-semibold tabular-nums">0h</span>;
  if (d > 0)   return <span className="text-[var(--negative)] font-semibold tabular-nums">+{d}h</span>;
  return              <span className="text-[var(--warning)] font-semibold tabular-nums">{d}h</span>;
}

// ─── DesvioCell ───────────────────────────────────────────────────────────────
// Quando Realizadas ainda não foi preenchido, oferece um botão "↺ replicar"
// que copia Previstas → Realizadas. Quando preenchido, mostra o desvio.
function DesvioCell({ forecast, consolidated, onReplicate }) {
  const fc = Number(forecast) || 0;
  const filled = consolidated !== null && consolidated !== "" && consolidated !== undefined;
  if (filled) return <Desvio forecast={forecast} consolidated={consolidated} />;
  if (fc <= 0) return <span className="text-[var(--text-3)]">—</span>;
  return (
    <button
      onClick={onReplicate}
      title={`Replicar ${fc}h previsto para realizado`}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors whitespace-nowrap"
    >
      ↺ replicar
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AlocacoesApp() {
  // Restaura listas + db do localStorage para evitar re-fetch em toda recarga.
  // Refresh em background dispara só se cache > 5min (controlado nos effects abaixo).
  // Defesa: cada cache valida tipo antes de usar — se estrutura corrompida, ignora silenciosamente.
  const _peopleCache = readCache('people');
  const _projMetaCache = readCache('projectMeta');
  const _ccCache = readCache('projectToCc');
  const _yrInit = (new Date()).getFullYear();
  const _dbCache = readCache('db', String(_yrInit));

  const _peopleData = Array.isArray(_peopleCache?.data) ? _peopleCache.data : null;
  const _projMetaData = _projMetaCache?.data && typeof _projMetaCache.data === 'object' && !Array.isArray(_projMetaCache.data) ? _projMetaCache.data : null;
  const _ccData = _ccCache?.data && typeof _ccCache.data === 'object' && !Array.isArray(_ccCache.data) ? _ccCache.data : null;
  const _dbRows = Array.isArray(_dbCache?.rows) ? _dbCache.rows : null;

  const [people, setPeople] = useState(() => _peopleData || []);
  const [projects, setProjects] = useState(() =>
    _projMetaData ? Object.keys(_projMetaData) : []
  );
  const bus = DEFAULT_BUS;

  const today = new Date();
  const persisted = typeof window !== "undefined"
    ? safeJsonParse(localStorage.getItem(PERSIST_KEY) || "{}", {})
    : {};

  // Ano/semana sempre começam na corrente — persisted é ignorado intencionalmente.
  const [selectedYear, setSelectedYear]   = useState(today.getFullYear());
  const [selectedWeek, setSelectedWeek]   = useState(getISOWeek(today));
  const [person, setPerson]               = useState(persisted.person || "");
  const { start, end } = useMemo(() => weekStartEnd(selectedYear, selectedWeek), [selectedYear, selectedWeek]);

  const blankEntry = () => ({ id: uid(), project: "", businessUnit: bus[0] || "", hours_forecast: "", hours_consolidated: "" });
  const [entries, setEntries] = useState(() =>
    Array.isArray(persisted.entries) && persisted.entries.length ? persisted.entries : [blankEntry()]
  );
  const [db, setDb]                         = useState(() => _dbRows || []);
  const [dbFilter, setDbFilter]             = useState("");
  const [dbOpen, setDbOpen]                 = useState(false);
  // Mapa project name → CC mais comum, alimentado pelo histórico carregado.
  // Permite auto-preencher Centro de Custo ao selecionar projeto.
  const [projectToCc, setProjectToCc]       = useState(() => _ccData || {});
  const [saving, setSaving]                 = useState(false);
  const [loadingWeek, setLoadingWeek]       = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false); // carga em background do ano (para mapa CC)
  // Indica o que está em `db` agora: 'empty', 'year-2026', 'week-2026-W14' etc.
  // Permite saber se o Dashboard precisa recarregar ou pode reusar.
  const [dbScope, setDbScope] = useState(() => _dbRows?.length ? `year-${_yrInit}` : 'empty');
  const [previewSort, setPreviewSort]       = useState({ field: "ISO_Week", dir: "desc" });
  const [previewWeek, setPreviewWeek]       = useState(null); // null = semana mais recente
  const [editingId, setEditingId]           = useState(null);
  const [editingValues, setEditingValues]   = useState(null);
  const [view, setView]                     = useState(() => {
    const v = persisted.view;
    // Migração transitória: chaves antigas "directory" e "timesheet" → "lancar".
    if (v === "directory" || v === "timesheet" || !v) return "lancar";
    return v;
  });
  const [theme, setTheme]                   = useState(() => {
    if (typeof window === "undefined") return "light";
    const s = persisted.theme || localStorage.getItem("theme");
    if (s === "dark" || s === "light") return s;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [toast, setToast]       = useState("");
  const toastRef                = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);
  // Token agora é injetado pelo proxy /api/clickup server-side. Limpa resíduo antigo do localStorage.
  useEffect(() => { try { localStorage.removeItem('cu:token'); } catch {} }, []);

  const blankPlanRow   = () => ({ id: uid(), businessUnit: bus[0] || "", project: "", hours_forecast: "" });
  const blankPlanGroup = () => ({ id: uid(), person: "", rows: [blankPlanRow()] });
  const [planGroups, setPlanGroups] = useState(() => {
    const saved = safeJsonParse(localStorage.getItem("ts:plan:v1") || "null", null);
    return Array.isArray(saved) && saved.length ? saved : [blankPlanGroup()];
  });

  // ── Aba Projeto ────────────────────────────────────────────────────────────
  const blankProjetoRow = () => ({ id: uid(), person: "", businessUnit: bus[0] || "", hours_forecast: "", hours_consolidated: "" });
  const [projetoProject, setProjetoProject] = useState("");
  const [projetoRows, setProjetoRows]       = useState([blankProjetoRow()]);

  function showToast(msg) {
    if (!toastRef.current) toastRef.current = {};
    setToast(msg);
    clearTimeout(toastRef.current.t);
    toastRef.current.t = setTimeout(() => setToast(""), 2600);
  }

  useEffect(() => {
    const root = document.documentElement;
    theme === "dark" ? root.classList.add("dark") : root.classList.remove("dark");
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ selectedYear, selectedWeek, person, entries, view, theme }));
    } catch {}
  }, [selectedYear, selectedWeek, person, entries, view, theme]);

  useEffect(() => {
    try { localStorage.setItem("ts:plan:v1", JSON.stringify(planGroups)); } catch {}
  }, [planGroups]);

  useEffect(() => {
    planGroups.forEach(g => { if (g.person) loadPlanRowsForGroup(g.id, g.person, selectedYear, selectedWeek); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedWeek]);

  useEffect(() => {
    if (projetoProject) loadProjetoRows(projetoProject, selectedYear, selectedWeek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedWeek]);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setHelpOpen(v => !v); }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setHelpOpen(v => !v); }
      if (e.shiftKey) {
        if (e.key === "1") { e.preventDefault(); setView("lancar"); }
        if (e.key === "2") { e.preventDefault(); setView("planning"); }
        if (e.key === "3") { e.preventDefault(); setView("projeto"); }
        if (e.key === "4") { e.preventDefault(); setView("dashboard"); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Metadados dos projetos (Cliente, CC, Categoria/Interno). Usado pelo Dashboard.
  const [projectMeta, setProjectMeta] = useState(() => _projMetaData || {}); // map { projectName → { cliente, centroCusto, categoria, formato, isInterno } }

  // ─── Persistência debounced no localStorage (stale-while-revalidate) ─────
  // Salva db/projectMeta/projectToCc/people em cache para sobreviver a reloads.
  // Importante: declarados DEPOIS de todos os useState que referenciam, pra evitar TDZ.
  useEffect(() => {
    if (!db.length) return;
    const t = setTimeout(() => {
      const scope = dbScope.startsWith('year-') ? dbScope.replace('year-', '') : '';
      if (scope) writeCache('db', { rows: db }, scope);
    }, 500);
    return () => clearTimeout(t);
  }, [db, dbScope]);

  useEffect(() => {
    if (!Object.keys(projectMeta).length) return;
    const t = setTimeout(() => writeCache('projectMeta', { data: projectMeta }), 500);
    return () => clearTimeout(t);
  }, [projectMeta]);

  useEffect(() => {
    if (!Object.keys(projectToCc).length) return;
    const t = setTimeout(() => writeCache('projectToCc', { data: projectToCc }), 500);
    return () => clearTimeout(t);
  }, [projectToCc]);

  useEffect(() => {
    if (!people.length) return;
    const t = setTimeout(() => writeCache('people', { data: people }), 500);
    return () => clearTimeout(t);
  }, [people]);

  async function loadLists() {
    try {
      const [ppl, projsMeta] = await Promise.all([cuPeople.loadAll(), cuProjects.loadAllWithMeta()]);
      if (ppl.length) setPeople(ppl.map(p => p.name));
      if (projsMeta.length) {
        setProjects(projsMeta.map(p => p.name));
        const meta = {};
        for (const p of projsMeta) meta[p.name] = p;
        setProjectMeta(meta);
        // Semeia o mapa projeto → CC com a fonte autoritativa (LISTA_PROJETOS),
        // antes que o loadLastYear venha por cima com a votação.
        setProjectToCc(prev => {
          const next = { ...prev };
          for (const p of projsMeta) {
            if (p.centroCusto && !next[p.name]) next[p.name] = p.centroCusto;
          }
          return next;
        });
      }
    } catch (e) { console.warn("loadLists:", e); }
  }
  useEffect(() => {
    // Skip se cache ainda fresco — evita rede a cada reload do app
    if (isCacheFresh(_peopleCache) && isCacheFresh(_projMetaCache)) return;
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Constrói/atualiza o mapa project → CC a partir das entries carregadas.
  // Para cada projeto, escolhe o CC mais frequente no histórico (vota por contagem).
  function mergeRowsIntoCcMap(rows) {
    if (!rows?.length) return;
    setProjectToCc(prev => {
      // Conta votos: { project: { cc: count } }
      const votes = {};
      // Re-conta a partir do map atual (não temos histórico de votos individuais)
      // — assume cada projeto valia ≥1 voto pra seu cc atual.
      Object.entries(prev).forEach(([p, cc]) => { votes[p] = { [cc]: 1 }; });
      rows.forEach(r => {
        if (!r.Project || !r.Business_Unit) return;
        votes[r.Project] ??= {};
        votes[r.Project][r.Business_Unit] = (votes[r.Project][r.Business_Unit] || 0) + 1;
      });
      const next = { ...prev };
      Object.entries(votes).forEach(([proj, counts]) => {
        const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        next[proj] = winner;
      });
      return next;
    });
  }

  // Carga inicial em background: puxa o ano todo. Mas se cache local for fresco
  // (<5min) E houver linhas válidas, pula — usa o que já restaurou nos useState lazies.
  useEffect(() => {
    if (_dbRows && isCacheFresh(_dbCache)) return; // cache fresco e válido — nada a fazer
    let cancelled = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const yr = today.getFullYear();
        const rows = await loadLastYear(yr);
        if (cancelled) return;
        mergeRowsIntoCcMap(rows);
        setDb(rows);
        setDbScope(`year-${yr}`);
      } catch (e) { console.warn("loadLastYear (cc map):", e); }
      finally { if (!cancelled) setLoadingHistory(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando entra na aba Dashboard, garante que o ano corrente está em `db`.
  // Se `db` representa só uma semana (porque o user veio da aba Lançar), recarrega o ano.
  useEffect(() => {
    if (view !== 'dashboard') return;
    const wantScope = `year-${selectedYear}`;
    if (dbScope === wantScope) return; // já temos o ano carregado
    let cancelled = false;
    (async () => {
      try {
        setLoadingHistory(true);
        const rows = await loadLastYear(selectedYear);
        if (cancelled) return;
        mergeRowsIntoCcMap(rows);
        setDb(rows);
        setDbScope(wantScope);
      } catch (e) { console.warn('loadYear (dashboard):', e); showToast('Erro ao carregar ano.'); }
      finally { if (!cancelled) setLoadingHistory(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedYear]);

  useEffect(() => {
    if (people.length && person && !people.includes(person)) setPerson("");
  }, [people]);

  // Auto-carrega dados do ClickUp quando pessoa, ano ou semana mudam (apenas na aba Lançar).
  // Silent = não abre o painel de DB nem mostra toast — UX de "abriu/selecionou, já tá lá".
  useEffect(() => {
    if (view !== "lancar" || !person) return;
    loadFromClickUp({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, selectedYear, selectedWeek, view]);

  function prevWeek() {
    if (selectedWeek > 1) setSelectedWeek(w => w - 1);
    else { setSelectedYear(y => y - 1); setSelectedWeek(52); }
  }
  function nextWeek() {
    if (selectedWeek < 52) setSelectedWeek(w => w + 1);
    else { setSelectedYear(y => y + 1); setSelectedWeek(1); }
  }
  function goToToday() {
    const t = new Date();
    setSelectedYear(t.getFullYear());
    setSelectedWeek(getISOWeek(t));
  }

  const totalForecast     = useMemo(() => entries.reduce((s, e) => s + (Number(e.hours_forecast) || 0), 0), [entries]);
  const totalConsolidated = useMemo(() => entries.reduce((s, e) => s + (Number(e.hours_consolidated) || 0), 0), [entries]);
  const desvioTotal       = totalConsolidated - totalForecast;

  function updateEntry(id, field, value) {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = { ...e };
      if (field === "hours_forecast" || field === "hours_consolidated") {
        if (value === "") { next[field] = ""; return next; }
        let n = parseInt(value, 10);
        if (isNaN(n)) n = 0;
        n = Math.max(0, Math.min(40, n));
        if (field === "hours_forecast") {
          const otherTotal = prev.filter(r => r.id !== id).reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
          if (otherTotal + n > 40) { n = Math.max(0, 40 - otherTotal); showToast("Limite de 40h atingido."); }
        }
        next[field] = n;
      } else { next[field] = value; }
      // Auto-preenche CC quando seleciona projeto, se o mapa souber.
      if (field === "project" && value && projectToCc[value]) {
        next.businessUnit = projectToCc[value];
      }
      return next;
    }));
  }

  function addRow()       { setEntries(p => [...p, blankEntry()]); }
  function removeRow(id)  {
    if (entries.length === 1) return;
    if (!window.confirm("Remover esta linha?")) return;
    setEntries(p => p.filter(e => e.id !== id));
  }
  function clearEntries() { setEntries([blankEntry()]); }

  // ─── Planning (multi-person) ──────────────────────────────────────────────
  function addPlanGroup() { setPlanGroups(p => [...p, blankPlanGroup()]); }
  function removePlanGroup(gid) { setPlanGroups(p => p.filter(g => g.id !== gid)); }
  async function loadPlanRowsForGroup(gid, person, year, week) {
    if (!person) return;
    try {
      const yearReady = dbScope === `year-${year}`;
      let rows;
      if (yearReady) {
        rows = db.filter(r => r.Year === year && r.ISO_Week === week);
      } else {
        setLoadingWeek(true);
        rows = await loadForWeek(year, week);
        mergeWeekIntoDb(year, week, rows);
        mergeRowsIntoCcMap(rows);
      }
      const mine = rows.filter(r => r.Person === person);
      setPlanGroups(p => p.map(g => {
        if (g.id !== gid || g.person !== person) return g;
        if (!mine.length) return { ...g, rows: [blankPlanRow()] };
        return {
          ...g,
          rows: mine.map(r => ({
            id: uid(),
            project: r.Project,
            businessUnit: r.Business_Unit || (bus[0] || ""),
            hours_forecast: r.Hours_Forecast ?? "",
          })),
        };
      }));
    } catch (e) {
      console.warn(e);
      showToast("Erro ao carregar lançamentos da semana.");
    } finally {
      setLoadingWeek(false);
    }
  }
  async function setPlanPerson(gid, person) {
    setPlanGroups(p => p.map(g => g.id === gid ? { ...g, person, rows: [blankPlanRow()] } : g));
    await loadPlanRowsForGroup(gid, person, selectedYear, selectedWeek);
  }
  function addPlanRow(gid) { setPlanGroups(p => p.map(g => g.id === gid ? { ...g, rows: [...g.rows, blankPlanRow()] } : g)); }
  function removePlanRow(gid, rid) { setPlanGroups(p => p.map(g => g.id === gid ? { ...g, rows: g.rows.filter(r => r.id !== rid) } : g)); }
  function updatePlanRow(gid, rid, field, value) {
    setPlanGroups(prev => prev.map(g => {
      if (g.id !== gid) return g;
      return {
        ...g,
        rows: g.rows.map(r => {
          if (r.id !== rid) return r;
          if (field === "hours_forecast") {
            if (value === "") return { ...r, hours_forecast: "" };
            let n = parseInt(value, 10);
            if (isNaN(n)) n = 0;
            n = Math.max(0, Math.min(40, n));
            const otherTotal = g.rows.filter(pr => pr.id !== rid).reduce((s, pr) => s + (Number(pr.hours_forecast) || 0), 0);
            if (otherTotal + n > 40) { n = Math.max(0, 40 - otherTotal); showToast(`Cap 40h atingido${g.person ? ` — ${g.person}` : ""}.`); }
            return { ...r, hours_forecast: n };
          }
          const next = { ...r, [field]: value };
          // Auto-preenche CC quando seleciona projeto, se o mapa souber.
          if (field === "project" && value && projectToCc[value]) {
            next.businessUnit = projectToCc[value];
          }
          return next;
        }),
      };
    }));
  }

  async function loadProjetoRows(project, year, week) {
    try {
      const yearReady = dbScope === `year-${year}`;
      let rows;
      if (yearReady) {
        rows = db.filter(r => r.Year === year && r.ISO_Week === week);
      } else {
        setLoadingWeek(true);
        rows = await loadForWeek(year, week);
        mergeWeekIntoDb(year, week, rows);
        mergeRowsIntoCcMap(rows);
      }
      const forProject = rows.filter(r => r.Project === project);
      setProjetoRows(forProject.length
        ? forProject.map(r => ({
            id: uid(),
            person: r.Person,
            businessUnit: r.Business_Unit || (bus[0] || ""),
            hours_forecast:     r.Hours_Forecast     ?? "",
            hours_consolidated: r.Hours_Consolidated ?? "",
          }))
        : [blankProjetoRow()]
      );
    } catch (e) {
      console.warn(e);
      showToast("Erro ao carregar alocações do projeto.");
    } finally {
      setLoadingWeek(false);
    }
  }

  async function selectProjetoProject(project) {
    setProjetoProject(project);
    setProjetoRows([blankProjetoRow()]);
    if (project) await loadProjetoRows(project, selectedYear, selectedWeek);
  }

  function updateProjetoRow(id, field, value) {
    setProjetoRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field === "hours_forecast" || field === "hours_consolidated") {
        if (value === "") return { ...r, [field]: "" };
        let n = parseInt(value, 10);
        if (isNaN(n)) n = 0;
        return { ...r, [field]: Math.max(0, Math.min(40, n)) };
      }
      const next = { ...r, [field]: value };
      if (field === "person" && value && projectToCc[projetoProject]) {
        next.businessUnit = projectToCc[projetoProject];
      }
      return next;
    }));
  }

  async function saveProjetoRows() {
    if (!projetoProject) { showToast("Selecione um projeto."); return; }
    const valid = projetoRows.filter(r => r.person && (Number(r.hours_forecast) > 0 || Number(r.hours_consolidated) > 0));
    if (!valid.length) { showToast("Preencha pelo menos uma pessoa com horas."); return; }
    const mkRow = r => ({
      Year: selectedYear, ISO_Week: selectedWeek,
      Person: r.person, Project: projetoProject, Business_Unit: r.businessUnit,
      Hours_Forecast:     Number(r.hours_forecast)     || null,
      Hours_Consolidated: Number(r.hours_consolidated) || null,
    });
    try {
      setSaving(true);
      const forecastRows     = valid.filter(r => Number(r.hours_forecast) > 0).map(mkRow);
      const consolidatedRows = valid.filter(r => Number(r.hours_consolidated) > 0).map(mkRow);
      if (forecastRows.length)     await upsertForecast(forecastRows);
      if (consolidatedRows.length) await upsertConsolidated(consolidatedRows);
      showToast(`Salvo — ${valid.length} pessoa${valid.length > 1 ? "s" : ""}.`);
    } catch (e) { console.warn(e); showToast("Erro ao salvar."); }
    finally { setSaving(false); }
  }

  async function savePlan() {
    const rows = planGroups.flatMap(g =>
      g.rows
        .filter(r => g.person && r.project && Number(r.hours_forecast) > 0)
        .map(r => ({
          Year: selectedYear, ISO_Week: selectedWeek,
          Person: g.person, Project: r.project, Business_Unit: r.businessUnit,
          Hours_Forecast: Number(r.hours_forecast), Hours_Consolidated: null,
        }))
    );
    if (!rows.length) { showToast("Preencha pessoa, projeto e horas em pelo menos uma linha."); return; }
    try {
      setSaving(true);
      await upsertForecast(rows);
      showToast(`Planejamento salvo — ${rows.length} linha${rows.length > 1 ? "s" : ""}.`);
    } catch (e) { console.warn(e); showToast("Erro ao salvar planejamento."); }
    finally { setSaving(false); }
  }

  function buildCuRows() {
    return entries
      .filter(e => Number(e.hours_forecast) > 0 || Number(e.hours_consolidated) > 0)
      .map(e => ({
        Year: selectedYear, ISO_Week: selectedWeek, Person: person,
        Project: e.project, Business_Unit: e.businessUnit,
        Hours_Forecast: Number(e.hours_forecast) || null,
        Hours_Consolidated: Number(e.hours_consolidated) || null,
      }));
  }

  async function save() {
    if (!person) { showToast("Selecione a pessoa."); return; }
    const rows = buildCuRows();
    if (!rows.length) { showToast("Nenhum dado para salvar."); return; }
    try {
      setSaving(true);
      const forecastRows     = rows.filter(r => r.Hours_Forecast != null);
      const consolidatedRows = rows.filter(r => r.Hours_Consolidated != null);
      if (forecastRows.length)     await upsertForecast(forecastRows);
      if (consolidatedRows.length) await upsertConsolidated(consolidatedRows);
      showToast(`Salvo (${rows.length} linha${rows.length > 1 ? "s" : ""}).`);
      loadFromClickUp({ silent: true, force: true });
    } catch (e) {
      console.error("save error:", e);
      showToast(`Erro ao salvar: ${e?.message || 'verifique o console.'}`);
    }
    finally { setSaving(false); }
  }

  // Merge: substitui no db as linhas da semana pelo novo conjunto (mantém o resto do ano).
  function mergeWeekIntoDb(year, week, weekRows) {
    setDb(prev => {
      const others = prev.filter(r => !(r.Year === year && r.ISO_Week === week));
      return [...others, ...weekRows];
    });
  }

  // Carrega entries da pessoa pra UI. Se o cache anual já tem o ano,
  // FILTRA EM MEMÓRIA (instantâneo). Senão, busca a semana e merge no cache.
  // `force=true` (botão Carregar Semana): sempre busca fresh + merge.
  async function loadFromClickUp({ silent = false, force = false } = {}) {
    if (!person) {
      if (!silent) showToast("Selecione a pessoa primeiro.");
      return;
    }
    const yearReady = dbScope === `year-${selectedYear}`;
    try {
      let rows;
      if (yearReady && !force) {
        // Cache hit: filtra em memória, sem rede
        rows = db.filter(r => r.Year === selectedYear && r.ISO_Week === selectedWeek);
      } else {
        // Cache miss (ou refresh forçado): busca só esta semana e merge no cache
        setLoadingWeek(true);
        rows = await loadForWeek(selectedYear, selectedWeek);
        mergeWeekIntoDb(selectedYear, selectedWeek, rows);
      }
      setPreviewPage(1);
      mergeRowsIntoCcMap(rows);
      if (!silent) setDbOpen(true);
      const mine = rows.filter(r => r.Person === person);
      if (mine.length) {
        setEntries(mine.map(r => ({
          id: uid(), project: r.Project, businessUnit: r.Business_Unit,
          hours_forecast: r.Hours_Forecast ?? "",
          hours_consolidated: r.Hours_Consolidated ?? "",
        })));
      } else {
        // Pessoa selecionada mas sem dados na semana — limpa para não mostrar entries de outra pessoa
        setEntries([blankEntry()]);
      }
      if (!silent) showToast(`${rows.length} registro${rows.length !== 1 ? "s" : ""} carregado${rows.length !== 1 ? "s" : ""}.`);
    } catch (e) {
      console.error("loadFromClickUp error:", e);
      if (!silent) showToast(`Erro ao carregar: ${e?.message || String(e)}`);
    }
    finally { setLoadingWeek(false); }
  }

  async function loadYear() {
    try {
      setLoadingWeek(true);
      const r = await loadLastYear(selectedYear, {
        onProgress: n => showToast(`Carregando… ${n} registros`),
      });
      if (!r.length) { showToast("Nenhum dado encontrado."); return; }
      setDb(r); setDbOpen(true);
      setDbScope(`year-${selectedYear}`);
      mergeRowsIntoCcMap(r);
      showToast(`${r.length} registros carregados.`);
    } catch { showToast("Erro ao carregar ano. Tente novamente."); }
    finally { setLoadingWeek(false); }
  }

  async function deleteDbRow(row) {
    try { await cuDeleteRow(row); setDb(p => p.filter(r => r.ID !== row.ID)); showToast("Removido."); }
    catch (e) { console.warn(e); showToast("Erro ao remover."); }
  }

  function startEditRow(row)   { setEditingId(row.ID); setEditingValues({ ...row }); }
  function cancelEditRow()     { setEditingId(null); setEditingValues(null); }
  function changeEditing(f, v) { setEditingValues(p => ({ ...p, [f]: v })); }

  async function saveEditRow() {
    if (!editingId || !editingValues) return;
    try {
      setSaving(true);
      await upsertForecast([{ ...editingValues, Hours_Forecast: Number(editingValues.Hours_Forecast) || null }]);
      if (editingValues.Hours_Consolidated != null)
        await upsertConsolidated([{ ...editingValues, Hours_Consolidated: Number(editingValues.Hours_Consolidated) || null }]);
      setDb(p => p.map(r => r.ID === editingId ? { ...editingValues } : r));
      showToast("Atualizado."); cancelEditRow();
    } catch (e) { console.warn(e); showToast("Erro ao atualizar."); }
    finally { setSaving(false); }
  }

  const filteredDb = useMemo(() => {
    if (!dbFilter) return db;
    const f = dbFilter.toLowerCase();
    return db.filter(r =>
      String(r.Person).toLowerCase().includes(f) ||
      String(r.Project).toLowerCase().includes(f) ||
      String(r.Business_Unit).toLowerCase().includes(f)
    );
  }, [db, dbFilter]);

  const sortedDb = useMemo(() => {
    const arr = [...filteredDb];
    const { field, dir } = previewSort;
    arr.sort((a, b) => {
      const va = a[field], vb = b[field];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return dir === "asc" ? va - vb : vb - va;
      return dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filteredDb, previewSort]);

  const previewWeeks = useMemo(() => [...new Set(filteredDb.map(r => r.ISO_Week).filter(Boolean))].sort((a, b) => b - a), [filteredDb]);
  const activeWeek   = previewWeek ?? previewWeeks[0] ?? null;
  const weekIdx      = previewWeeks.indexOf(activeWeek);
  const pagedDb      = useMemo(() => sortedDb.filter(r => r.ISO_Week === activeWeek), [sortedDb, activeWeek]);

  function toggleSort(f) {
    setPreviewSort(p => p.field === f ? { field: f, dir: p.dir === "asc" ? "desc" : "asc" } : { field: f, dir: "asc" });
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db.length ? db : []), "Registros");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(people.map(p => ({ Pessoa: p }))), "Pessoas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projects.map(p => ({ Projeto: p }))), "Projetos");
    XLSX.writeFile(wb, `SAL-Alocacoes_${selectedYear}_${format(new Date(), "yyyyMMdd")}.xlsx`);
  }

  // ─── Editorial design tokens (warm off-white + serif display) ────────────
  const bg        = "min-h-screen bg-[var(--canvas)] text-[var(--text-1)]";
  const card      = "bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)]";
  const inputCls  = "rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1.5 text-[14px] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-colors w-full";
  const btnBlue   = "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-[14px] font-medium disabled:opacity-40 transition-colors hover:bg-[var(--accent-hover)]";
  const btnGhost  = "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-transparent text-[var(--text-1)] text-[13px] font-medium disabled:opacity-40 transition-colors hover:bg-[var(--surface-alt)] hover:border-[var(--border-strong)]";
  const th        = "px-3 py-2 text-left text-[10.5px] font-semibold text-[var(--text-3)] uppercase tracking-[0.06em] whitespace-nowrap";
  const td        = "px-3 py-2";
  const sep       = "divide-y divide-[var(--border-subtle)]";

  const TABS = [
    { k: "lancar",    label: "Individual", icon: "⏱" },
    { k: "planning",  label: "Equipe",     icon: "📅" },
    { k: "projeto",   label: "Projeto",    icon: "🗂" },
    { k: "dashboard", label: "Painel",     icon: "📊" },
  ];

  const loadingLabel = saving ? 'Salvando…'
    : loadingWeek ? 'Carregando semana…'
    : loadingHistory ? 'Atualizando histórico…'
    : null;

  return (
    <div className={bg}>
      <TopProgressBar visible={!!loadingLabel} label={loadingLabel} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[var(--canvas)]/95 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 h-14 flex items-center gap-4">
          <span className="text-[15px] tracking-tight shrink-0">
            <span className="font-semibold">Grupo SAL</span>
            <span className="text-[var(--text-3)] mx-2">·</span>
            <span className="text-[var(--text-2)]">Alocações</span>
          </span>

          {/* Tabs — desktop, underline style */}
          <nav className="hidden sm:flex mx-auto gap-1">
            {TABS.map(t => {
              const active = view === t.k;
              return (
                <button key={t.k} onClick={() => setView(t.k)}
                  className={`relative px-4 py-3 text-[13.5px] font-medium transition-colors ${
                    active ? "text-[var(--text-1)]" : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                  }`}>
                  {t.label}
                  {active && (
                    <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-[var(--accent)] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto sm:ml-0 flex items-center gap-1">
            <button onClick={() => setHelpOpen(v => !v)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-alt)] transition-colors text-[14px]">
              ?
            </button>
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-alt)] transition-colors text-[14px]">
              {theme === "dark" ? "☀" : "◑"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 py-8 pb-32 sm:pb-16 space-y-10">

        {/* ══════════════════════════════════════════
            LANÇAR  (jornada do colaborador)
        ══════════════════════════════════════════ */}
        {view === "lancar" && (
          <>
            {/* Cabeçalho: Pessoa = título-botão grande (linha 1) | Semana+Status+Atualizar juntos (linha 2) */}
            <header className="pb-4 border-b border-[var(--border-subtle)] space-y-3">
              <PersonTitle
                value={person}
                onChange={setPerson}
                options={people}
                loading={people.length === 0}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <WeekNav
                  year={selectedYear} week={selectedWeek} start={start} end={end}
                  onPrev={prevWeek} onNext={nextWeek} onToday={goToToday}
                />
                <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
                  <WeekStatus entries={entries} />
                  <span className="text-[var(--text-3)]">·</span>
                  <button onClick={() => loadFromClickUp({ force: true })} disabled={loadingWeek || !person}
                    className="hover:text-[var(--accent)] disabled:opacity-40 transition-colors">
                    {loadingWeek ? "Atualizando…" : "↻ Atualizar"}
                  </button>
                </div>
              </div>
            </header>

            {/* Entry list — tabela em sm+ / cards verticais no mobile */}

            {/* MOBILE: cards (uma entry por bloco, sem scroll horizontal) */}
            <div className="sm:hidden space-y-2">
              {loadingWeek && !entries.some(e => e.project || e.hours_forecast || e.hours_consolidated) ? (
                <>
                  <div className="h-32 bg-[var(--surface)] rounded-lg border border-[var(--border-subtle)] animate-pulse" />
                  <div className="h-32 bg-[var(--surface)] rounded-lg border border-[var(--border-subtle)] animate-pulse" />
                </>
              ) : entries.map(e => (
                <div key={e.id} className={`${card} p-3 space-y-2.5`}>
                  {/* Linha 1: Projeto + Remover */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Combobox
                        value={e.project}
                        onChange={val => updateEntry(e.id, "project", val)}
                        options={projects}
                        placeholder={projects.length === 0 ? "Carregando…" : "Projeto…"}
                        className={`${inputCls} font-medium`}
                      />
                    </div>
                    <button onClick={() => removeRow(e.id)} aria-label="Remover"
                      className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-3)] hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] text-[18px] leading-none shrink-0">
                      ×
                    </button>
                  </div>
                  {/* Linha 2: CC (pill leve, full-width select escondido) */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] w-12 shrink-0">CC</span>
                    <select
                      value={e.businessUnit}
                      onChange={ev => updateEntry(e.id, "businessUnit", ev.target.value)}
                      className="flex-1 bg-transparent border-none text-[13.5px] text-[var(--text-2)] focus:outline-none focus:text-[var(--text-1)] cursor-pointer py-1"
                    >
                      {bus.map(b => <option key={b} value={b}>● {b}</option>)}
                    </select>
                  </div>
                  {/* Linha 3: Previstas | Realizadas | Desvio (grid 3 colunas iguais) */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-subtle)]">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] mb-1">Previstas</div>
                      <HoursInput
                        value={e.hours_forecast}
                        onChange={v => updateEntry(e.id, "hours_forecast", v)}
                        placeholder="0"
                        className={`${inputCls} text-center tabular-nums`}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] mb-1">Realizadas</div>
                      <HoursInput
                        value={e.hours_consolidated}
                        onChange={v => updateEntry(e.id, "hours_consolidated", v)}
                        placeholder="—"
                        className={`${inputCls} text-center tabular-nums`}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] mb-1">Desvio</div>
                      <div className="h-9 flex items-center justify-center text-[14px]">
                        <DesvioCell
                          forecast={e.hours_forecast}
                          consolidated={e.hours_consolidated}
                          onReplicate={() => updateEntry(e.id, "hours_consolidated", String(Number(e.hours_forecast) || 0))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* Botão adicionar — abaixo dos cards. Limpar à direita (discreto) */}
              <div className="flex items-stretch gap-2">
                <button onClick={addRow}
                  className="flex-1 py-2.5 rounded-lg border border-dashed border-[var(--border-strong)] text-[14px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                  + Adicionar projeto
                </button>
                {entries.length > 1 && (
                  <button onClick={clearEntries}
                    title="Limpar todos os projetos"
                    className="px-3 rounded-lg text-[13px] text-[var(--text-3)] hover:text-[var(--negative)] hover:bg-[var(--negative)]/5 transition-colors">
                    Limpar
                  </button>
                )}
              </div>
              {/* Total no mobile */}
              {entries.length > 0 && (
                <div className={`${card} p-3 flex items-center justify-between bg-[var(--surface-alt)]`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">Total</span>
                  <div className="flex items-center gap-4 text-[14px]">
                    <span className={`tabular-nums font-semibold ${totalForecast > 40 ? "text-[var(--negative)]" : "text-[var(--text-1)]"}`}>{totalForecast}h prev</span>
                    {totalConsolidated > 0 && (
                      <span className="tabular-nums font-semibold text-[var(--text-1)]">{totalConsolidated}h real</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* DESKTOP/TABLET: tabela tradicional */}
            <div className={`hidden sm:block ${card} overflow-x-auto`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className={th} style={{ minWidth: 220 }}>Projeto</th>
                    <th className={th}>Centro de Custo</th>
                    <th className={`${th} text-right`} style={{ width: 110 }}>Previstas</th>
                    <th className={`${th} text-right`} style={{ width: 110 }}>Realizadas</th>
                    <th className={`${th} text-right`} style={{ width: 90 }}>Desvio</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {loadingWeek && !entries.some(e => e.project || e.hours_forecast || e.hours_consolidated) ? (
                    <>
                      <SkeletonRow cells={6} />
                      <SkeletonRow cells={6} />
                      <SkeletonRow cells={6} />
                    </>
                  ) : entries.map(e => (
                    <tr key={e.id} className="group hover:bg-[var(--surface-alt)]/60 transition-colors">
                      <td className={td}>
                        <Combobox
                          value={e.project}
                          onChange={val => updateEntry(e.id, "project", val)}
                          options={projects}
                          placeholder={projects.length === 0 ? "Carregando…" : "Projeto…"}
                          className={`${inputCls} font-medium`}
                        />
                      </td>
                      <td className={td}>
                        <select
                          value={e.businessUnit}
                          onChange={ev => updateEntry(e.id, "businessUnit", ev.target.value)}
                          className="bg-transparent border-none text-[13.5px] text-[var(--text-2)] focus:outline-none focus:text-[var(--text-1)] cursor-pointer py-1 px-1 rounded hover:bg-[var(--surface-alt)]"
                        >
                          {bus.map(b => <option key={b} value={b}>● {b}</option>)}
                        </select>
                      </td>
                      <td className={`${td} text-right`}>
                        <HoursInput
                          value={e.hours_forecast}
                          onChange={v => updateEntry(e.id, "hours_forecast", v)}
                          placeholder="0"
                          className={`${inputCls} text-right tabular-nums`}
                        />
                      </td>
                      <td className={`${td} text-right`}>
                        <HoursInput
                          value={e.hours_consolidated}
                          onChange={v => updateEntry(e.id, "hours_consolidated", v)}
                          placeholder="—"
                          className={`${inputCls} text-right tabular-nums`}
                        />
                      </td>
                      <td className={`${td} text-right`}>
                        <DesvioCell
                          forecast={e.hours_forecast}
                          consolidated={e.hours_consolidated}
                          onReplicate={() => updateEntry(e.id, "hours_consolidated", String(Number(e.hours_forecast) || 0))}
                        />
                      </td>
                      <td className="pr-3 text-right">
                        <button onClick={() => removeRow(e.id)} aria-label="Remover linha"
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] transition-all text-[16px] leading-none">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Linha de adicionar / limpar — dentro da tabela, próxima dos projetos */}
                  <tr className="border-t border-[var(--border-subtle)]">
                    <td colSpan={6} className="p-0">
                      <div className="flex items-stretch">
                        <button onClick={addRow}
                          className="flex-1 px-4 py-3 text-left text-[13.5px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                          + Adicionar projeto
                        </button>
                        {entries.length > 1 && (
                          <button onClick={clearEntries}
                            title="Limpar todos os projetos"
                            className="px-4 py-3 text-[13px] text-[var(--text-3)] hover:text-[var(--negative)] hover:bg-[var(--negative)]/5 transition-colors">
                            Limpar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr className="border-t border-[var(--border-strong)] bg-[var(--surface-alt)]">
                    <td className={td}>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)]">Total</span>
                    </td>
                    <td className={td}></td>
                    <td className={`${td} text-right tabular-nums font-semibold ${totalForecast > 40 ? "text-[var(--negative)]" : "text-[var(--text-1)]"}`}>
                      {totalForecast}h
                    </td>
                    <td className={`${td} text-right tabular-nums font-semibold text-[var(--text-1)]`}>
                      {totalConsolidated > 0 ? `${totalConsolidated}h` : "—"}
                    </td>
                    <td className={`${td} text-right`}>
                      {totalConsolidated > 0 && <Desvio forecast={totalForecast} consolidated={totalConsolidated} />}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Ação primária — Salvar à direita, sozinha (hierarquia clara) */}
            <div className="flex justify-end pt-2">
              <button onClick={save}
                disabled={saving || (totalForecast === 0 && totalConsolidated === 0) || !person}
                className={btnBlue}>
                {saving ? "Salvando…" : "→ Salvar semana"}
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            PLANEJAMENTO  (jornada da gestora)
        ══════════════════════════════════════════ */}
        {view === "planning" && (
          <>
            {/* Cabeçalho: título "Planejamento" + nav semanal embaixo */}
            <header className="pb-4 border-b border-[var(--border-subtle)] space-y-3">
              <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.01em] text-[var(--text-1)]">
                Equipe
              </h1>
              <WeekNav
                year={selectedYear} week={selectedWeek} start={start} end={end}
                onPrev={prevWeek} onNext={nextWeek} onToday={goToToday}
              />
            </header>

            {/* Person groups */}
            <div className="space-y-4">
              {planGroups.map(g => {
                const groupTotal = g.rows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
                const isOver = groupTotal > 40;
                const isFull = groupTotal === 40;
                return (
                  <div key={g.id} className={card}>
                    {/* Person header — pessoa + cap pill + ✕ */}
                    <div className="px-4 py-3 flex items-center gap-3 border-b border-[var(--border-subtle)]">
                      <div className="flex-1 min-w-0 max-w-md">
                        <Combobox
                          value={g.person}
                          onChange={v => setPlanPerson(g.id, v)}
                          options={people}
                          placeholder={people.length === 0 ? "Carregando…" : "Selecionar pessoa…"}
                          className={`${inputCls} font-semibold text-[15px]`}
                        />
                      </div>
                      <div className={`text-[12.5px] font-semibold tabular-nums shrink-0 px-2.5 py-1 rounded-md ${
                        isOver ? "text-[var(--negative)] bg-[var(--negative)]/10"
                        : isFull ? "text-[var(--positive)] bg-[var(--positive)]/10"
                        : "text-[var(--text-2)] bg-[var(--surface-alt)]"
                      }`}>
                        {groupTotal}/40h
                      </div>
                      {planGroups.length > 1 && (
                        <button onClick={() => removePlanGroup(g.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-3)] hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] transition-colors text-[16px] leading-none shrink-0">
                          ×
                        </button>
                      )}
                    </div>

                    {/* MOBILE: cards verticais por linha */}
                    <div className="sm:hidden p-3 space-y-2">
                      {g.rows.map(r => (
                        <div key={r.id} className="rounded-lg border border-[var(--border-subtle)] p-2.5 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <Combobox
                                value={r.project}
                                onChange={v => updatePlanRow(g.id, r.id, "project", v)}
                                options={projects}
                                placeholder={projects.length === 0 ? "Carregando…" : "Projeto…"}
                                className={`${inputCls} font-medium`}
                              />
                            </div>
                            <button onClick={() => removePlanRow(g.id, r.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-3)] hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] text-[16px] leading-none shrink-0">
                              ×
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <select value={r.businessUnit} onChange={ev => updatePlanRow(g.id, r.id, "businessUnit", ev.target.value)}
                              className="flex-1 bg-transparent border-none text-[13.5px] text-[var(--text-2)] focus:outline-none focus:text-[var(--text-1)] cursor-pointer py-1">
                              {bus.map(b => <option key={b} value={b}>● {b}</option>)}
                            </select>
                            <div className="w-24">
                              <HoursInput
                                value={r.hours_forecast}
                                onChange={v => updatePlanRow(g.id, r.id, "hours_forecast", v)}
                                placeholder="0"
                                className={`${inputCls} text-right tabular-nums`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => addPlanRow(g.id)}
                        className="w-full py-2 rounded-lg border border-dashed border-[var(--border-strong)] text-[13.5px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                        + Adicionar projeto
                      </button>
                    </div>

                    {/* DESKTOP: tabela compacta */}
                    <div className="hidden sm:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--border-subtle)]">
                            <th className={th} style={{ minWidth: 200 }}>Projeto</th>
                            <th className={th}>Centro de Custo</th>
                            <th className={`${th} text-right`} style={{ width: 110 }}>Previstas</th>
                            <th style={{ width: 36 }} />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {g.rows.map(r => (
                            <tr key={r.id} className="group hover:bg-[var(--surface-alt)]/60 transition-colors">
                              <td className={td}>
                                <Combobox
                                  value={r.project}
                                  onChange={v => updatePlanRow(g.id, r.id, "project", v)}
                                  options={projects}
                                  placeholder={projects.length === 0 ? "Carregando…" : "Projeto…"}
                                  className={`${inputCls} font-medium`}
                                />
                              </td>
                              <td className={td}>
                                <select value={r.businessUnit} onChange={ev => updatePlanRow(g.id, r.id, "businessUnit", ev.target.value)}
                                  className="bg-transparent border-none text-[13.5px] text-[var(--text-2)] focus:outline-none focus:text-[var(--text-1)] cursor-pointer py-1 px-1 rounded hover:bg-[var(--surface-alt)]">
                                  {bus.map(b => <option key={b} value={b}>● {b}</option>)}
                                </select>
                              </td>
                              <td className={`${td} text-right`}>
                                <HoursInput
                                  value={r.hours_forecast}
                                  onChange={v => updatePlanRow(g.id, r.id, "hours_forecast", v)}
                                  placeholder="0"
                                  className={`${inputCls} text-right tabular-nums`}
                                />
                              </td>
                              <td className="pr-3 text-right">
                                <button onClick={() => removePlanRow(g.id, r.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] transition-all text-[16px] leading-none">
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[var(--border-subtle)]">
                            <td colSpan={4} className="p-0">
                              <button onClick={() => addPlanRow(g.id)}
                                className="w-full px-4 py-2.5 text-left text-[13.5px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                                + Adicionar projeto
                              </button>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add person — bloco ghost no fim */}
            <button onClick={addPlanGroup}
              className="w-full py-3 rounded-lg border border-dashed border-[var(--border-strong)] text-[14px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
              + Adicionar pessoa
            </button>

            {/* Ação primária + reset discreto */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button onClick={() => { if (window.confirm("Limpar todo o planejamento?")) setPlanGroups([blankPlanGroup()]); }}
                className="px-3 py-2 rounded-md text-[13px] text-[var(--text-3)] hover:text-[var(--negative)] transition-colors">
                Limpar planejamento
              </button>
              <button onClick={savePlan} disabled={saving} className={btnBlue}>
                {saving ? "Salvando…" : "→ Salvar planejamento"}
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            PROJETO  (alocação por projeto)
        ══════════════════════════════════════════ */}
        {view === "projeto" && (
          <>
            <header className="pb-4 border-b border-[var(--border-subtle)] space-y-3">
              <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.01em] text-[var(--text-1)]">
                Projeto
              </h1>
              <WeekNav
                year={selectedYear} week={selectedWeek} start={start} end={end}
                onPrev={prevWeek} onNext={nextWeek} onToday={goToToday}
              />
            </header>

            <div className={card}>
              {/* Seletor de projeto */}
              <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                <Combobox
                  value={projetoProject}
                  onChange={selectProjetoProject}
                  options={projects}
                  placeholder={projects.length === 0 ? "Carregando…" : "Selecionar projeto…"}
                  className={`${inputCls} font-semibold text-[15px] max-w-md`}
                />
              </div>

              {/* MOBILE: cards */}
              <div className="sm:hidden p-3 space-y-2">
                {projetoRows.map(r => (
                  <div key={r.id} className="rounded-lg border border-[var(--border-subtle)] p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <Combobox
                          value={r.person}
                          onChange={v => updateProjetoRow(r.id, "person", v)}
                          options={people}
                          placeholder="Pessoa…"
                          className={`${inputCls} font-medium`}
                        />
                      </div>
                      <button onClick={() => setProjetoRows(p => p.filter(x => x.id !== r.id))}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-3)] hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] text-[16px] leading-none shrink-0">
                        ×
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={r.businessUnit} onChange={e => updateProjetoRow(r.id, "businessUnit", e.target.value)}
                        className="flex-1 bg-transparent border-none text-[13.5px] text-[var(--text-2)] focus:outline-none focus:text-[var(--text-1)] cursor-pointer py-1">
                        {bus.map(b => <option key={b} value={b}>● {b}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] text-[var(--text-3)] uppercase tracking-wider">Previstas</label>
                        <HoursInput value={r.hours_forecast} onChange={v => updateProjetoRow(r.id, "hours_forecast", v)}
                          placeholder="0" className={`${inputCls} text-right tabular-nums mt-1`} />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] text-[var(--text-3)] uppercase tracking-wider">Realizadas</label>
                        <div className="flex items-center gap-1 mt-1">
                          <DesvioCell
                            forecast={r.hours_forecast}
                            consolidated={r.hours_consolidated}
                            onReplicate={() => updateProjetoRow(r.id, "hours_consolidated", String(Number(r.hours_forecast) || 0))}
                          />
                          <HoursInput value={r.hours_consolidated} onChange={v => updateProjetoRow(r.id, "hours_consolidated", v)}
                            placeholder="0" className={`${inputCls} text-right tabular-nums flex-1`} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(() => {
                  const totalF = projetoRows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
                  const totalC = projetoRows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
                  if (!totalF && !totalC) return null;
                  return (
                    <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-[var(--surface-alt)] text-[13px] font-semibold tabular-nums">
                      <span className="text-[var(--text-3)] uppercase tracking-wider text-[11px]">Total</span>
                      <div className="flex gap-4">
                        {totalF > 0 && <span className="text-[var(--text-1)]">Prev: {totalF}h</span>}
                        {totalC > 0 && <span className="text-[var(--text-1)]">Real: {totalC}h</span>}
                      </div>
                    </div>
                  );
                })()}
                <button onClick={() => setProjetoRows(p => [...p, blankProjetoRow()])}
                  className="w-full py-2 rounded-lg border border-dashed border-[var(--border-strong)] text-[13.5px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                  + Adicionar pessoa
                </button>
              </div>

              {/* DESKTOP: tabela */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className={th} style={{ minWidth: 180 }}>Pessoa</th>
                      <th className={th}>Centro de Custo</th>
                      <th className={`${th} text-right`} style={{ width: 110 }}>Previstas</th>
                      <th className={`${th} text-right`} style={{ width: 110 }}>Realizadas</th>
                      <th style={{ width: 36 }} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {projetoRows.map(r => (
                      <tr key={r.id} className="group hover:bg-[var(--surface-alt)]/60 transition-colors">
                        <td className={td}>
                          <Combobox
                            value={r.person}
                            onChange={v => updateProjetoRow(r.id, "person", v)}
                            options={people}
                            placeholder="Pessoa…"
                            className={`${inputCls} font-medium`}
                          />
                        </td>
                        <td className={td}>
                          <select value={r.businessUnit} onChange={e => updateProjetoRow(r.id, "businessUnit", e.target.value)}
                            className="bg-transparent border-none text-[13.5px] text-[var(--text-2)] focus:outline-none focus:text-[var(--text-1)] cursor-pointer py-1 px-1 rounded hover:bg-[var(--surface-alt)]">
                            {bus.map(b => <option key={b} value={b}>● {b}</option>)}
                          </select>
                        </td>
                        <td className={`${td} text-right`}>
                          <HoursInput value={r.hours_forecast} onChange={v => updateProjetoRow(r.id, "hours_forecast", v)}
                            placeholder="0" className={`${inputCls} text-right tabular-nums`} />
                        </td>
                        <td className={`${td} text-right`}>
                          <div className="flex items-center justify-end gap-2">
                            <DesvioCell
                              forecast={r.hours_forecast}
                              consolidated={r.hours_consolidated}
                              onReplicate={() => updateProjetoRow(r.id, "hours_consolidated", String(Number(r.hours_forecast) || 0))}
                            />
                            <HoursInput value={r.hours_consolidated} onChange={v => updateProjetoRow(r.id, "hours_consolidated", v)}
                              placeholder="0" className={`${inputCls} text-right tabular-nums w-20`} />
                          </div>
                        </td>
                        <td className="pr-3 text-right">
                          <button onClick={() => setProjetoRows(p => p.filter(x => x.id !== r.id))}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:bg-[var(--negative)]/10 hover:text-[var(--negative)] transition-all text-[16px] leading-none">
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[var(--border-subtle)]">
                      <td colSpan={5} className="p-0">
                        <button onClick={() => setProjetoRows(p => [...p, blankProjetoRow()])}
                          className="w-full px-4 py-2.5 text-left text-[13.5px] font-medium text-[var(--text-2)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
                          + Adicionar pessoa
                        </button>
                      </td>
                    </tr>
                    {(() => {
                      const totalF = projetoRows.reduce((s, r) => s + (Number(r.hours_forecast) || 0), 0);
                      const totalC = projetoRows.reduce((s, r) => s + (Number(r.hours_consolidated) || 0), 0);
                      if (!totalF && !totalC) return null;
                      return (
                        <tr className="border-t-2 border-[var(--border-subtle)] bg-[var(--surface-alt)]/50">
                          <td colSpan={2} className={`${td} text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]`}>
                            Total
                          </td>
                          <td className={`${td} text-right tabular-nums font-semibold text-[var(--text-1)]`}>
                            {totalF > 0 ? `${totalF}h` : "—"}
                          </td>
                          <td className={`${td} text-right tabular-nums font-semibold text-[var(--text-1)]`}>
                            {totalC > 0 ? `${totalC}h` : "—"}
                          </td>
                          <td />
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={saveProjetoRows} disabled={saving || !projetoProject} className={btnBlue}>
                {saving ? "Salvando…" : "→ Salvar projeto"}
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            VISÃO GERAL  (jornada do gestor)
        ══════════════════════════════════════════ */}
        {view === "dashboard" && (
          <>
            {/* Dashboard charts */}
            <Dashboard
              db={db}
              projectMeta={projectMeta}
              people={people}
              person={person}
              selectedWeek={selectedWeek}
              selectedYear={selectedYear}
              recordsContent={(() => {
                const recordsJsx = (
                <div>
                  {/* Seletor de semana no topo */}
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-3">
                    <label className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wide shrink-0">Semana</label>
                    <select value={activeWeek ?? ''} onChange={e => setPreviewWeek(Number(e.target.value))}
                      className={`${inputCls} max-w-[140px]`}>
                      {previewWeeks.map(w => <option key={w} value={w}>W{String(w).padStart(2,'0')}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <button onClick={() => setPreviewWeek(previewWeeks[weekIdx + 1])} disabled={weekIdx >= previewWeeks.length - 1}
                        className={`${btnGhost} py-1 px-2.5 text-[13px]`}>←</button>
                      <button onClick={() => setPreviewWeek(previewWeeks[weekIdx - 1])} disabled={weekIdx <= 0}
                        className={`${btnGhost} py-1 px-2.5 text-[13px]`}>→</button>
                    </div>
                    <span className="ml-auto text-[13px] text-[var(--text-3)]">{pagedDb.length} registro{pagedDb.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Filtro de texto */}
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]/40">
                    <input value={dbFilter} onChange={e => setDbFilter(e.target.value)}
                      placeholder="Filtrar por pessoa, projeto ou CC…" className={`${inputCls} max-w-xs`} />
                    {dbFilter && <button onClick={() => { setDbFilter(""); setPreviewWeek(null); }} className="text-[13px] text-[var(--text-3)] hover:text-black dark:hover:text-white">Limpar</button>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-alt)]">
                          {[{k:"ISO_Week",label:"Sem."},{k:"Person",label:"Pessoa"},{k:"Project",label:"Projeto"},{k:"Business_Unit",label:"CC"},{k:"Hours_Forecast",label:"Prev."},{k:"Hours_Consolidated",label:"Real."},{k:"_desvio",label:"Desvio"}].map(col => (
                            <th key={col.k} className={th}>
                              {col.k === "_desvio" ? col.label : (
                                <button onClick={() => toggleSort(col.k)} className="flex items-center gap-1 hover:text-black dark:hover:text-white transition-colors">
                                  {col.label}
                                  {previewSort.field === col.k && <span className="text-[var(--accent)]">{previewSort.dir === "asc" ? "↑" : "↓"}</span>}
                                </button>
                              )}
                            </th>
                          ))}
                          <th />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {pagedDb.map(r => (
                          <tr key={r.ID} className="group hover:bg-[var(--surface-alt)] transition-colors">
                            {editingId === r.ID ? (
                              <>
                                <td className={td}><span className="text-[var(--text-3)] text-[13px] tabular-nums">W{toTwo(r.ISO_Week)}</span></td>
                                <td className={td}><Combobox value={editingValues.Person} onChange={v => changeEditing("Person", v)} options={people} placeholder="Pessoa…" className={inputCls} /></td>
                                <td className={td}><Combobox value={editingValues.Project} onChange={v => changeEditing("Project", v)} options={projects} placeholder="Projeto…" className={inputCls} /></td>
                                <td className={td}><select className={inputCls} value={editingValues.Business_Unit} onChange={e => changeEditing("Business_Unit", e.target.value)}>{bus.map(b => <option key={b} value={b}>{b}</option>)}</select></td>
                                <td className={td}><HoursInput value={editingValues.Hours_Forecast ?? ""} onChange={v => changeEditing("Hours_Forecast", v)} className={`${inputCls} w-16 text-center`} /></td>
                                <td className={td}><HoursInput value={editingValues.Hours_Consolidated ?? ""} onChange={v => changeEditing("Hours_Consolidated", v)} className={`${inputCls} w-16 text-center`} /></td>
                                <td className={td} />
                                <td className={td}><div className="flex gap-2"><button onClick={saveEditRow} className="px-3 py-1.5 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium">Salvar</button><button onClick={cancelEditRow} className="px-3 py-1.5 rounded-[8px] bg-[var(--surface-alt)] text-[13px]">↩</button></div></td>
                              </>
                            ) : (
                              <>
                                <td className={`${td} tabular-nums text-[var(--text-3)] text-[13px]`}>W{toTwo(r.ISO_Week)}</td>
                                <td className={`${td} font-medium`}>{r.Person}</td>
                                <td className={td}>{r.Project}</td>
                                <td className={td}><span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-[var(--surface-alt)] text-[var(--text-3)]">{r.Business_Unit}</span></td>
                                <td className={`${td} text-center tabular-nums`}>{r.Hours_Forecast ?? "—"}</td>
                                <td className={`${td} text-center tabular-nums`}>{r.Hours_Consolidated != null ? r.Hours_Consolidated : <span className="text-[var(--text-3)]">—</span>}</td>
                                <td className={`${td} text-center`}>{r.Hours_Consolidated != null ? <Desvio forecast={r.Hours_Forecast} consolidated={r.Hours_Consolidated} /> : <span className="text-[var(--text-3)]">—</span>}</td>
                                <td className={td}><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => startEditRow(r)} className="px-2 py-1 rounded-[6px] text-[var(--accent)] hover:bg-[var(--accent-soft)] text-[13px]">✏</button><button onClick={() => deleteDbRow(r)} className="px-2 py-1 rounded-[6px] text-[var(--negative)] hover:bg-[var(--negative)]/10 text-[13px]">×</button></div></td>
                              </>
                            )}
                          </tr>
                        ))}
                        {!pagedDb.length && <tr><td colSpan={8} className="py-12 text-center text-[15px] text-[var(--text-3)]">{db.length === 0 ? 'Use "Carregar Semana" ou "Carregar Ano".' : "Nenhum resultado para o filtro."}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {previewWeeks.length > 0 && (
                    <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-[13px] text-[var(--text-3)]">
                        W{String(activeWeek).padStart(2,'0')} · {pagedDb.length} registro{pagedDb.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPreviewWeek(previewWeeks[weekIdx + 1])} disabled={weekIdx >= previewWeeks.length - 1} className={`${btnGhost} py-1.5 px-3`}>←</button>
                        <select value={activeWeek ?? ''} onChange={e => setPreviewWeek(Number(e.target.value))}
                          className="text-[13px] rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 focus:outline-none">
                          {previewWeeks.map(w => <option key={w} value={w}>W{String(w).padStart(2,'0')}</option>)}
                        </select>
                        <button onClick={() => setPreviewWeek(previewWeeks[weekIdx - 1])} disabled={weekIdx <= 0} className={`${btnGhost} py-1.5 px-3`}>→</button>
                      </div>
                    </div>
                  )}
                </div>
              ); return recordsJsx; })()}
            />
          </>
        )}

        {view === "directory" && <Directory onListsChanged={loadLists} />}
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-28 sm:bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-[var(--text-1)] text-[var(--canvas)] text-[14px] font-medium px-4 py-2.5 rounded-lg shadow-lg whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}

      {/* ── Help modal — slides up from bottom on mobile ── */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setHelpOpen(false)} />
          <div className={`relative w-full sm:max-w-sm ${card} pt-6 pb-8 px-6 shadow-2xl rounded-t-3xl sm:rounded-2xl`}>
            {/* Pull handle */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-[#8E8E93]/40 mx-auto mb-6" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-[17px]">Atalhos</h2>
              <button onClick={() => setHelpOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-alt)] text-[var(--text-3)] hover:text-black dark:hover:text-white text-[18px] leading-none">
                ×
              </button>
            </div>
            <div className={`${card} overflow-hidden`}>
              <div className={sep}>
                {[
                  ["Shift + 1", "Lançar"],
                  ["Shift + 2", "Planejamento"],
                  ["Shift + 3", "Visão Geral"],
                  ["?  ou  Ctrl+K", "Esta ajuda"],
                ].map(([k, v]) => (
                  <div key={k} className="px-4 py-3 flex items-center justify-between">
                    <code className="px-2 py-1 rounded-[6px] bg-[var(--surface-alt)] font-mono text-[13px]">{k}</code>
                    <span className="text-[15px] text-[var(--text-3)]">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom nav — mobile only ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] flex">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setView(t.k)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              view === t.k ? "text-[var(--accent)]" : "text-[var(--text-3)]"
            }`}>
            <span className="text-[22px] leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
