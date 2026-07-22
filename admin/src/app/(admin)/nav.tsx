'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { supabaseBrowser } from '@/lib/supabase/client';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/rezepte', label: 'Rezepte' },
  { href: '/kurse', label: 'Kurse' },
];

// Session 14: Broadcast, Q&A, Gutscheine, Nutzerinnen
const UPCOMING = ['Broadcast', 'Q&A', 'Gutscheine', 'Nutzerinnen'];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      {LINKS.map((link) => {
        const active =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={`navlink${active ? ' active' : ''}`}>
            {link.label}
          </Link>
        );
      })}
      <div className="nav-hint">Folgt in Session 14</div>
      {UPCOMING.map((label) => (
        <span key={label} className="navlink disabled">
          {label}
        </span>
      ))}
      <div className="foot">
        <button className="btn btn-ghost btn-small" onClick={signOut}>
          Abmelden
        </button>
      </div>
    </>
  );
}
