'use client';
import { useEffect, useRef, useState } from 'react';

/** Generic click-to-open dropdown. Closes on outside click or Escape. */
export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger(open)}</span>
      {open && <div className={`dropdown-menu ${align === 'left' ? 'left' : ''}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  href,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const cls = `dropdown-item${danger ? ' danger' : ''}${disabled ? ' disabled' : ''}`;
  if (href && !disabled) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <div className="dropdown-label">{children}</div>;
}

export function DropdownSeparator() {
  return <div className="dropdown-sep" />;
}
