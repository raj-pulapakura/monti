import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Monti — Turn lesson ideas into interactive experiences',
  description:
    'Turn any teaching idea into an interactive learning experience — in minutes, no coding.',
  openGraph: {
    title: 'Monti — Turn lesson ideas into interactive experiences',
    description:
      'Describe a lesson idea. Monti turns it into an interactive experience your learners can actually play — in minutes, no coding.',
    siteName: 'Monti',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monti — Turn lesson ideas into interactive experiences',
    description:
      'Describe a lesson idea. Monti turns it into an interactive experience your learners can actually play — in minutes, no coding.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} antialiased`}>{children}</body>
    </html>
  );
}
