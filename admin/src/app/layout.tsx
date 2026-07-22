import type { Metadata } from 'next';
import { Italiana, Manrope } from 'next/font/google';
import './globals.css';

const italiana = Italiana({
  variable: '--font-italiana',
  weight: '400',
  subsets: ['latin'],
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'IRI Admin',
  description: 'Verwaltung für die IRI-App',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${italiana.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
