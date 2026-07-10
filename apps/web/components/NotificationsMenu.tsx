'use client';
import { Dropdown } from './Dropdown';

/** Honest placeholder: real notification delivery isn't wired yet, so this
 * shows a clean empty state rather than fabricated alerts. */
export function NotificationsMenu() {
  return (
    <Dropdown
      trigger={() => (
        <button type="button" className="icon-trigger" aria-label="Notifications" title="Notifications">
          🔔
        </button>
      )}
    >
      {() => (
        <div className="empty-state" style={{ padding: '28px 16px', minWidth: 220 }}>
          <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>🔔</div>
          <h4 style={{ fontSize: 13.5 }}>You&rsquo;re all caught up</h4>
          <p style={{ fontSize: 12.5 }}>New activity will show up here.</p>
        </div>
      )}
    </Dropdown>
  );
}
