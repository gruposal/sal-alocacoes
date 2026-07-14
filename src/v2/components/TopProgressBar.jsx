// Indicador global de loading — barra fina no topo da tela inteira, com rótulo
// opcional. Mesmo padrão da v1 (mais visível que texto solto no canto do header).
export default function TopProgressBar({ visible, label }) {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[10000] pointer-events-none transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden={!visible}
    >
      <div className="h-[2px] bg-[var(--accent-soft)] overflow-hidden">
        <div className="h-full w-1/3 bg-[var(--accent)] tp-indeterminate" />
      </div>
      {label && (
        <div className="hidden sm:block absolute right-3 top-1.5 text-[10.5px] text-[var(--text-2)] bg-[var(--surface)]/95 backdrop-blur px-2 py-0.5 rounded-md border border-[var(--border-subtle)] shadow-sm pointer-events-none">
          {label}
        </div>
      )}
    </div>
  );
}
