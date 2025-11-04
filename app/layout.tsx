import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ankur - AI Farmer Interview Platform',
  description: 'AI-assisted farmer interview system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

