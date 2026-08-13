// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirects the user to the login page when they visit the root URL (/)
  redirect('/login');
}
