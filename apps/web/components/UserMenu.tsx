'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '../lib/api';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from './Dropdown';

export function UserMenu() {
  const router = useRouter();
  const [name, setName] = useState('Account');
  const [email, setEmail] = useState('');

  useEffect(() => {
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.name) setName(u.name);
      else if (u?.email) setName(u.email.split('@')[0]);
      if (u?.email) setEmail(u.email);
    } catch {}
  }, []);

  const initial = name.trim().charAt(0).toUpperCase() || 'A';

  const signOut = () => {
    logout();
    router.push('/login');
  };

  return (
    <Dropdown
      trigger={() => (
        <button type="button" className="profile-trigger" aria-label="Account menu">
          <span className="avatar-circle">{initial}</span>
        </button>
      )}
    >
      {() => (
        <>
          <DropdownLabel>{email || name}</DropdownLabel>
          <DropdownItem href="/settings">Profile</DropdownItem>
          <DropdownItem href="/settings">Business settings</DropdownItem>
          <DropdownSeparator />
          <DropdownItem danger onClick={signOut}>Sign out</DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
