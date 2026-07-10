import Link from 'next/link';

/**
 * Shared placeholder for a Rev-2 module whose route exists (so the frozen
 * sidebar never links to a 404) but whose full build is scheduled for a
 * later implementation phase. Honest about state — never fake data.
 */
export function ModuleStub({
  icon,
  title,
  phase,
  description,
  backTo,
  backLabel,
}: {
  icon: string;
  title: string;
  phase: string;
  description: string;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <span className="muted">{phase}</span>
        </div>
        <span className="badge">Coming online</span>
      </div>
      <div className="panel" style={{ textAlign: 'center', padding: '56px 24px' }}>
        <div
          className="feature-ico"
          style={{ width: 56, height: 56, fontSize: 26, margin: '0 auto 18px' }}
        >
          {icon}
        </div>
        <h3 style={{ marginBottom: 8 }}>{title} is being built</h3>
        <p className="muted" style={{ maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>
          {description}
        </p>
        {backTo && (
          <Link href={backTo} className="btn ghost sm" style={{ marginTop: 20, display: 'inline-block' }}>
            {backLabel ?? 'Back to Dashboard'}
          </Link>
        )}
      </div>
    </>
  );
}
