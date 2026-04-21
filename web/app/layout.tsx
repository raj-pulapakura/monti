import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { AuthProvider } from './context/auth-context';
import { CreditsBalanceProvider } from './context/credits-balance-context';
import { FloatingFeedbackButton } from './components/floating-feedback-button';
import './globals.css';

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Monti — Turn any idea into an interactive experience',
  description:
    'Describe any topic. Monti turns it into an interactive experience you can share — in minutes, no coding.',
  openGraph: {
    title: 'Monti — Turn any idea into an interactive experience',
    description:
      'Describe any topic. Monti turns it into an interactive experience you can share — in minutes, no coding.',
    siteName: 'Monti',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monti — Turn any idea into an interactive experience',
    description:
      'Describe any topic. Monti turns it into an interactive experience you can share — in minutes, no coding.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} antialiased`}>
        <AuthProvider>
          <CreditsBalanceProvider>{children}</CreditsBalanceProvider>
        </AuthProvider>
        <FloatingFeedbackButton />
      </body>
    </html>
  );
}
