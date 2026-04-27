/** @type {import('next').NextConfig} */
const nextConfig = {
  // No Next.js 15+, esta chave saiu de 'experimental' e foi para a raiz
  allowedDevOrigins: ['168.119.230.7', 'localhost:3000'],
  
  devIndicators: {
    appIsrStatus: false,
  },
  // Se precisares de ignorar erros de typescript no build para andar mais rápido:
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;