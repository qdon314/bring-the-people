import type { Metadata } from 'next'
import { Providers } from './providers'
import { Sidebar } from '@/components/layout/Sidebar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bring the People',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-bg font-sans text-text antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main id="main-content" className="flex-1 flex flex-col min-w-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
