// src/app/layout.tsx
import { Providers } from './providers';
import './globals.css';

export const metadata = {
  title: 'LoanTrack | MFI Dashboard',
  description: 'Microfinance Loan Tracking and Reporting System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Removed next/font, using Tailwind's default font-sans */}
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
