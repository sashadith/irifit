import { Nav } from './nav';

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="shell">
      <Nav />
      <main className="main">{children}</main>
    </div>
  );
}
