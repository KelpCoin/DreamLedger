import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fight Edge - MMA/Boxing',
  description: 'Evidence-led fight information, analysis, discussion and historical context.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
