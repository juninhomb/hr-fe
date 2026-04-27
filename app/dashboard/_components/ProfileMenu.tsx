'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('admin');
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const u = localStorage.getItem('hrstore-user');
    if (u) setUsername(u);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleLogout = () => {
    localStorage.removeItem('hrstore-token');
    localStorage.removeItem('hrstore-user');
    router.replace('/login');
  };

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-zinc-100 transition group"
      >
        <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-white text-sm">
          {initials}
        </div>
        <ChevronDown size={14} className={`text-zinc-400 group-hover:text-black transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center font-bold text-white text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black truncate">{username}</p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Administrador</p>
              </div>
            </div>
          </div>

          <div className="py-1">
            <button
              disabled
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-400 cursor-not-allowed text-left"
            >
              <UserIcon size={15} />
              <span>Perfil</span>
              <span className="ml-auto text-[9px] uppercase font-bold tracking-wider text-zinc-300">Em breve</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition text-left"
            >
              <LogOut size={15} />
              <span className="font-semibold">Terminar Sessão</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
