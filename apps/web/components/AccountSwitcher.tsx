'use client';
import { useEffect, useState } from 'react';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';

export function AccountSwitcher() {
  const [businessName, setBusinessName] = useState('Your Business');

  useEffect(() => {
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.tenant?.name) setBusinessName(u.tenant.name);
    } catch {}
  }, []);

  const initial = businessName.trim().charAt(0).toUpperCase() || 'B';

  return (
    <Dropdown
      align="left"
      trigger={() => (
        <button type="button" className="switcher-trigger">
          <span className="avatar-circle">{initial}</span>
          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {businessName}
          </span>
          <span className="muted" style={{ fontSize: 10 }}>▾</span>
        </button>
      )}
    >
      {() => (
        <>
          <DropdownLabel>Business</DropdownLabel>
          <DropdownItem disabled>
            <span className="avatar-circle">{initial}</span> {businessName}
            <span className="dropdown-check">✓</span>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem href="/settings">Business settings</DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
