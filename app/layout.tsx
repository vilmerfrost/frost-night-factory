import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SupabaseProvider } from './components/SupabaseProvider'
import { ThemeProvider } from './theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Frost Night Factory",
  description: "Autonomous AI Software Factory",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  )
}