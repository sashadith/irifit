import type { Metadata } from 'next';
import { Antic_Didone, Manrope } from 'next/font/google';
import './globals.css';

/** Display-Schrift wie in App und auf irinadith.com: Antic Didone (löst Italiana ab, 09.08.) */
const anticDidone = Antic_Didone({
  variable: '--font-display-face',
  weight: '400',
  subsets: ['latin'],
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'IriFit Admin',
  description: 'Verwaltung für die IriFit-App',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${anticDidone.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
