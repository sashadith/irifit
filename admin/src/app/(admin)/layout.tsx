import { Nav } from './nav';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <aside className="sidebar">
        {/* Wortmarke FINAL (IRI-Branding.html, 22.07.): Italiana, „Iri" Tinte + „Fit" Slogan-Grau */}
        <div className="brand">
          Iri<span style={{ color: '#8a7b8e' }}>Fit</span>{' '}
          <span style={{ fontSize: 20, color: 'var(--muted)' }}>Admin</span>
        </div>
        <Nav />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
