import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Monti MVP',
  description:
    'Generate and refine interactive learning experiences from prompts with safe iframe rendering.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
