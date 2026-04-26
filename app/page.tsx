'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FullAppPrototype from './dashboard/page';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('hrstore-token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  // Enquanto o componente não "monta" no navegador, não renderizamos nada
  // para evitar que o HTML do servidor seja diferente do cliente.
  if (!mounted) {
    return null;
  }

  return <FullAppPrototype />;
}