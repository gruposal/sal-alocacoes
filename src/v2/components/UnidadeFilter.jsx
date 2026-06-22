export default function UnidadeFilter({ unidades, value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-[var(--text-secondary)] font-medium uppercase tracking-wide">Unidade</span>
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onChange(null)}
          className={`text-sm px-3 py-1 rounded-full border transition-colors ${
            value === null
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
          }`}
        >
          Todas
        </button>
        {unidades.map(u => (
          <button
            key={u}
            onClick={() => onChange(u)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              value === u
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}
