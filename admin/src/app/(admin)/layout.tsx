import { Nav } from './nav';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          IRI <span>Admin</span>
        </div>
        <Nav />
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
