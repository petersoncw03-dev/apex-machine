'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Cpu, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function NovaSenhaPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Verifica se há uma sessão válida logo na montagem
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Quando o usuário clica no link do e-mail, o Supabase loga ele através da hash na URL e redireciona para cá.
        // Se após ler os parâmetros ainda não houver sessão (link expirado, inválido, etc).
        
        // Supabase lida automaticamente com os `#access_token=...` da URL quando usamos createClient()
        // Mas se a sessão não existir após alguns instantes, o link é inválido.
      }
    };
    checkSession();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem!' });
      return;
    }
    
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    } else {
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso! Redirecionando...' });
      setTimeout(() => {
        router.push('/painel-master');
      }, 2000);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] p-4 font-sans selection:bg-[#00ff41]/30 relative overflow-hidden">
      
      {/* Luz ambiente de fundo (Glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00ff41]/[0.06] blur-[100px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#e51e3e]/[0.03] blur-[80px] rounded-full pointer-events-none z-0 translate-x-[30%] -translate-y-[30%]"></div>

      {/* Container Principal */}
      <div className="w-full max-w-[400px] bg-black/40 backdrop-blur-2xl border border-[#00ff41]/10 rounded-[24px] p-8 flex flex-col items-center shadow-[0_0_80px_rgba(0,255,65,0.12),inset_0_0_20px_rgba(0,255,65,0.05)] relative z-10 transition-all duration-500 hover:shadow-[0_0_100px_rgba(0,255,65,0.18),inset_0_0_20px_rgba(0,255,65,0.05)]">
        
        {/* Logotipo SVG Apex Machine */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center relative w-20 h-20 mb-1">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              <defs>
                <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path d="M50 15 L80 65 L70 65 L50 30 L30 65 L20 65 Z" fill="#00ff41" filter="url(#glow-green)" />
              <path d="M45 45 L75 60 L45 75 L45 65 L60 60 L45 55 Z" fill="#e51e3e" filter="url(#glow-red)" />
            </svg>
          </div>
          <h1 className="text-xl font-mono tracking-[0.2em] text-white font-light drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] flex gap-2">
            <span className="text-[#00ff41]">APEX</span>
            <span className="text-[#e51e3e]">MACHINE</span>
          </h1>
        </div>

        {/* Subtítulo */}
        <div className="flex items-center gap-2 text-white/40 text-xs font-mono tracking-widest mb-8 text-center px-4">
          <Cpu size={14} className="text-[#00ff41] shrink-0" />
          <span>CRIE SUA NOVA SENHA DE ACESSO</span>
        </div>

        {message.text && (
           <div className={`w-full border text-xs text-center py-2.5 px-4 rounded-xl mb-5 font-mono shadow-sm
              ${message.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}
           `}>
              {message.text}
           </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Nova Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#00ff41] transition-colors">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-black/50 border border-white/10 hover:border-white/20 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00ff41]/50 focus:bg-[#00ff41]/[0.02] transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/30 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Confirmar Nova Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#00ff41] transition-colors">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua nova senha"
                className="w-full bg-black/50 border border-white/10 hover:border-white/20 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00ff41]/50 focus:bg-[#00ff41]/[0.02] transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || message.type === 'success'}
            className="relative w-full bg-[#00ff41]/10 border border-[#00ff41]/50 hover:bg-[#00ff41]/20 hover:border-[#00ff41] text-[#00ff41] font-mono tracking-widest font-bold text-xs py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,65,0.1)] hover:shadow-[0_0_25px_rgba(0,255,65,0.25)] disabled:opacity-70 flex justify-center items-center mt-2 overflow-hidden group uppercase"
          >
            <div className="absolute inset-0 bg-[#00ff41]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative z-10 drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]">
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </span>
          </button>

        </form>
      </div>

    </main>
  );
}
