'use client';

import { useEffect, useState } from 'react';
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

/** Wortmarke FINAL (IRI-Branding.html, 22.07.): Antic Didone, „Iri" Rosé + „Fit" Slogan-Grau */
function Brand() {
  return (
    <div className="brand">
      <span style={{ color: '#d25578' }}>Iri</span>
      <span style={{ color: '#8a7b8e' }}>Fit</span>{' '}
      <span style={{ fontSize: '0.6em', color: 'var(--muted)' }}>Admin</span>
    </div>
  );
}

/**
 * Navigation für beide Größen (Session 25): auf dem Desktop die feste
 * Seitenleiste wie gehabt, unter 860px eine Kopfzeile mit Schublade. Der
 * Öffnungszustand lebt hier, weil das Layout darüber eine Server-Komponente
 * bleiben soll.
 */
export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Hintergrund nicht mitscrollen lassen, solange die Schublade offen ist
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      <header className="topbar">
        <Brand />
        <button
          type="button"
          className="navtoggle"
          aria-expanded={open}
          aria-controls="hauptnavigation"
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <aside id="hauptnavigation" className={`sidebar${open ? ' open' : ''}`}>
        <Brand />
        {LINKS.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`navlink${active ? ' active' : ''}`}
              // Schublade direkt beim Tippen schließen statt über einen Effekt auf
              // den Pfad — sonst rendert die Navigation nach jedem Wechsel zweimal
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="foot">
          <button className="btn btn-ghost btn-small" onClick={signOut}>
            Abmelden
          </button>
        </div>
      </aside>

      {open ? (
        <button type="button" className="scrim" aria-label="Menü schließen" onClick={() => setOpen(false)} />
      ) : null}
    </>
  );
}
