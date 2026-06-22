import { getISOWeek, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { format } from 'date-fns';

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

    </div>
  );
}
