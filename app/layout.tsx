import type { Metadata } from 'next';
import { JetBrains_Mono, Inter } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TerraLens — Spatial Decision Intelligence Platform',
  description:
    'Testing whether contextual GIS heuristics improve high-stakes infrastructure emergency triage over traditional technical severity. Powered by Flagsmith Experimentation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-[#0284C7] selection:text-white">
        {children}
      </body>
    </html>
  );
}
