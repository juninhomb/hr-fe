'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';
import api from '../../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  // Auto-redirect se já tiver sessão
  useEffect(() => {
    const token = localStorage.getItem('hrstore-token');
    if (token) {
      router.replace('/');
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const cleanUser = username.trim().toLowerCase();
      const response = await api.post('/login', { username: cleanUser, password });
      setError('');
      localStorage.setItem('hrstore-token', response.data.token);
      localStorage.setItem('hrstore-user', cleanUser);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro de ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] text-slate-900 p-4">
      <div className="bg-white p-10 rounded-[32px] shadow-xl border border-gray-100 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">HR STORE</h1>
          <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase mt-1">Admin Suite</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Utilizador</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                required
                autoFocus
                placeholder="Digite o utilizador"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-zinc-50 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/10 outline-none transition text-sm lowercase"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-zinc-50 border border-transparent focus:bg-white focus:border-black focus:ring-2 focus:ring-black/10 outline-none transition text-sm"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-black rounded-lg hover:bg-zinc-100 transition"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-xs font-semibold bg-red-50 px-4 py-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white p-4 rounded-2xl font-bold hover:bg-zinc-800 transition shadow-lg shadow-black/10 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                A entrar...
              </>
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-zinc-400 mt-8 tracking-wider uppercase font-bold">
          Sessão protegida por JWT
        </p>
      </div>
    </div>
  );
}
