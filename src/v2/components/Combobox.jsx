import { useState, useEffect, useRef, useMemo } from 'react';

function normalizeMatch(s) {
  return (s || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Combobox({ value, onChange, options, placeholder, className }) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState(value ?? '');
  const [rect, setRect]           = useState(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef  = useRef(null);
  const listRef   = useRef(null);
  const itemRefs  = useRef([]);

  useEffect(() => { setQuery(value ?? ''); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e) => {
      if (listRef.current?.contains(e.target)) return;
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    const cur = filtered.findIndex(o => o === value);
    setHighlight(cur >= 0 ? cur : 0);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open) return;
    const el = itemRefs.current[highlight];
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
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
      if (open && filtered[highlight]) { e.preventDefault(); select(filtered[highlight]); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false); }
    }
  }

  function handleBlur(e) {
    if (listRef.current?.contains(e.relatedTarget)) return;
    const q = normalizeMatch(query);
    const match = options.find(o => normalizeMatch(o) === q);
    if (match) { onChange(match); setQuery(match); }
    else { setQuery(value ?? ''); }
    setOpen(false);
  }

  const dropStyle = useMemo(() => {
    if (!rect) return {};
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const maxH = Math.min(320, Math.max(spaceBelow, spaceAbove) - 16);
    const top = spaceBelow >= maxH + 8 ? rect.bottom + 4 : rect.top - maxH - 4;
    const isMobile = window.innerWidth < 640;
    return isMobile
      ? { position: 'fixed', top, left: 12, right: 12, maxHeight: maxH, zIndex: 9999 }
      : { position: 'fixed', top, left: rect.left, width: Math.max(rect.width, 280), maxHeight: maxH, zIndex: 9999 };
  }, [rect]);

  return (
    <>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); openDropdown(); }}
        onFocus={() => { setQuery(''); openDropdown(); }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off" autoCorrect="off" spellCheck={false}
        role="combobox" aria-expanded={open}
      />
      {open && filtered.length > 0 && rect && (
        <div
          ref={listRef}
          style={dropStyle}
          className="flex flex-col rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg text-[14px] overflow-hidden"
        >
          <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wide text-[var(--text-2)] border-b border-[var(--border-subtle)] bg-[var(--surface-alt)] shrink-0">
            {filtered.length} {filtered.length === 1 ? 'opção' : 'opções'}
          </div>
          <ul role="listbox" className="overflow-y-auto flex-1 overscroll-contain">
            {filtered.map((opt, i) => (
              <li
                key={opt}
                ref={el => (itemRefs.current[i] = el)}
                role="option"
                aria-selected={opt === value}
                tabIndex={-1}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={e => { e.preventDefault(); select(opt); }}
                onTouchEnd={e => { e.preventDefault(); select(opt); }}
                className={[
                  'px-3 py-2 cursor-pointer border-b border-[var(--border-subtle)] last:border-0',
                  i === highlight ? 'bg-[var(--surface-alt)]' : '',
                  opt === value ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text-1)]',
                ].join(' ')}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
