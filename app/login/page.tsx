'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Faz o pedido para a rota que criámos no backend anteriormente
      const response = await api.post('/login', { username, password });
      
      // Guarda o token JWT no localStorage do navegador
      localStorage.setItem('hrstore-token', response.data.token);
      
      // Redireciona para a home onde o Dashboard vai carregar os dados
      router.push('/');
    } catch (err) {
      setError('Credenciais inválidas. Tenta admin / rafa321');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-black">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-96">
        <h1 className="text-3xl font-black mb-6 text-center italic tracking-tighter">HR STORE</h1>
        {error && <p className="text-red-500 text-sm mb-4 text-center font-bold">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" placeholder="Utilizador" 
            className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-black outline-none transition"
            value={username} onChange={e => setUsername(e.target.value)}
          />
          <input 
            type="password" placeholder="Password" 
            className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-black outline-none transition"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <button className="w-full bg-black text-white p-4 rounded-2xl font-bold hover:bg-zinc-800 transition shadow-lg">
            Entrar no Painel
          </button>
        </form>
      </div>
    </div>
  );
}