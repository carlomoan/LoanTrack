// src/app/layout.tsx
import { Providers } from './providers';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata = {
  title: 'LoanTrack | MFI Dashboard',
  description: 'Microfinance Loan Tracking and Reporting System',
};

// suppressHydrationWarning on <html>: next-themes sets class/style there
// after hydration to apply the theme; without it React warns about the
// server/client attribute mismatch on every load.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}