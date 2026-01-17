// Configuração da URL do backend
// Altere isso após fazer deploy no Vercel
export const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://wellinton-game-dev-tools.vercel.app'
  : 'http://localhost:3000'; // Desenvolvimento local

export const USE_BACKEND_PROXY = true; // Mude para true quando quiser usar o backend (desativado por padrão para desenvolvimento local)
