// components/ui/CommandMenu.tsx
'use client';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Search, Home, Users, FileText, Settings, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden">
        <Command.Input placeholder="Search or jump to..." className="w-full px-4 py-4 text-lg outline-none border-b border-gray-100" />
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-gray-500">No results found.</Command.Empty>

          <Command.Group heading="Suggestions" className="text-xs text-gray-400 px-2">
            <Command.Item onSelect={() => { router.push('/dashboard'); setOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100">
              <Home className="w-4 h-4" /> Dashboard
            </Command.Item>
            <Command.Item onSelect={() => { router.push('/loans'); setOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100">
              <FileText className="w-4 h-4" /> View Loans
            </Command.Item>
            <Command.Item onSelect={() => { router.push('/members'); setOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100">
              <Users className="w-4 h-4" /> Manage Members
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Preferences" className="text-xs text-gray-400 px-2">
            <Command.Item onSelect={() => { setTheme('light'); setOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100">
              <Sun className="w-4 h-4" /> Change to Light Mode
            </Command.Item>
            <Command.Item onSelect={() => { setTheme('dark'); setOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100">
              <Moon className="w-4 h-4" /> Change to Dark Mode
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
