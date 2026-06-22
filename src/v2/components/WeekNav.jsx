import { getISOWeek, startOfISOWeek, endOfISOWeek, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';
import { getFeriado, setFeriado, getWeekCap } from '../lib/feriados.js';

// Retorna a data da segunda-feira de uma semana ISO.
function mondayOfWeek(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const d = new Date(jan4);
  d.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  return d;
}

export default function WeekNav({ year, week, onNavigate }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentWeek = getISOWeek(today);
  const isToday = year === currentYear && week === currentWeek;

  const monday = mondayOfWeek(year, week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const feriados = getFeriado(year, week);
  const cap = getWeekCap(year, week);

  function prev() {
    const d = subWeeks(monday, 1);
    onNavigate(d.getFullYear(), getISOWeek(d));
  }

  function next() {
    const d = addWeeks(monday, 1);
    onNavigate(d.getFullYear(), getISOWeek(d));
  }

  function goToday() {
    onNavigate(currentYear, currentWeek);
  }

  function cycleFeriado() {
    const next = (feriados + 1) % 5; // 0..4
    setFeriado(year, week, next);
    onNavigate(year, week); // re-render via parent state update
  }

  const dateRange = `${format(monday, 'd MMM', { locale: ptBR })} – ${format(sunday, 'd MMM', { locale: ptBR })}`;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1">
        <button
          onClick={prev}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors"
          aria-label="Semana anterior"
        >‹</button>

        <div className="text-center min-w-[160px]">
          <span className="font-semibold text-[var(--text-primary)] tabular-nums">
            Semana {String(week).padStart(2, '0')}
          </span>
          <span className="text-[var(--text-secondary)] text-sm ml-2">{dateRange}</span>
        </div>

        <button
          onClick={next}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors"
          aria-label="Próxima semana"
        >›</button>
      </div>

      {!isToday && (
        <button
          onClick={goToday}
          className="text-xs text-[var(--accent)] hover:underline"
        >↺ Hoje</button>
      )}

      {/* Feriado toggle */}
      <button
        onClick={cycleFeriado}
        title={`Dias de feriado nesta semana: ${feriados}. Clique para alterar.`}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
          feriados > 0
            ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400'
            : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
        }`}
      >
        {feriados > 0 ? `🗓 ${feriados}d feriado · cap ${cap}h` : '🗓 Feriado'}
      </button>
    </div>
  );
}
