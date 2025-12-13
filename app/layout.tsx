import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SupabaseProvider } from './components/SupabaseProvider'
import { ThemeProvider } from './theme-provider'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Frost Night Factory',
  description: 'AI-Powered App Builder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-gray-50`}>
        <SupabaseProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}