import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Reality Check Official',
  description: 'Cinematic 8K futuristic digital world',
  themeColor: '#0abdc6'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
