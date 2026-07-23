'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { supabaseBrowser } from '@/lib/supabase/client';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/rezepte', label: 'Rezepte' },
  { href: '/kurse', label: 'Kurse' },
  { href: '/trainings', label: 'Trainings' },
  { href: '/broadcast', label: 'Broadcast' },
  { href: '/qa', label: 'Q&A' },
  { href: '/gutscheine', label: 'Gutscheine' },
  { href: '/nutzerinnen', label: 'Nutzerinnen' },
];

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
      <div className="foot">
        <button className="btn btn-ghost btn-small" onClick={signOut}>
          Abmelden
        </button>
      </div>
    </>
  );
}
