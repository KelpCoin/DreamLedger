import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Swipe Streak Empire',
  description: 'Swipe products, build streaks, unlock worlds.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
