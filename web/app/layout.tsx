import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { TokenProvider } from '@/lib/token-context';

export const metadata: Metadata = {
  title: 'REPOSOUL — Give abandoned software a second life',
  description:
    'Discover abandoned open-source repositories, assess their revival potential, and generate structured revival blueprints.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'REPOSOUL — Open Source Resurrection Workbench',
    description: 'Give abandoned software a second life.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary min-h-screen flex flex-col">
        <TokenProvider>
          <Header />
          <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
            {children}
          </main>
          <footer className="border-t border-border py-6 text-center text-text-muted text-sm">
            REPOSOUL &mdash; Give abandoned software a second life
          </footer>
        </TokenProvider>
      </body>
    </html>
  );
}
