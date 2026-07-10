import Link from 'next/link';

/**
 * Shared placeholder for a module whose route exists (so the sidebar never
 * links to a 404) but whose full build hasn't landed yet. A polished product
 * empty state — never developer language, never a roadmap reference.
 */
export function ModuleStub({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
        </div>
      </div>
      <div className="panel empty-state" style={{ padding: '64px 24px' }}>
        <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>{icon}</div>
        <h4 style={{ fontSize: 16, marginBottom: 8 }}>{description}</h4>
        {action && (
          <Link href={action.href} className="btn sm">
            {action.label}
          </Link>
        )}
      </div>
    </>
  );
}
