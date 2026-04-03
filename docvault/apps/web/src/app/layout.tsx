import './global.css';
import Link from 'next/link';
import { Providers } from '../components/providers';

export const metadata = {
  title: 'DocVault',
  description: 'RAG-enabled document store',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <nav className="border-b bg-card px-6 py-3 flex items-center gap-6">
            <span className="font-semibold text-sm">DocVault</span>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Documents
            </Link>
            <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Search
            </Link>
            <Link href="/activity" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Activity
            </Link>
            <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pipeline
            </Link>
          </nav>
          <main className="container mx-auto px-6 py-8 max-w-5xl">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
