'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Send, Cpu, UserPlus, Gift } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister && password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem!');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');

    if (isRegister) {
       const { error, data } = await supabase.auth.signUp({ email, password });
       if (error) {
         setErrorMsg(error.message);
         setLoading(false);
       } else {
         if (inviteCode && data?.user) {
            try {
               await fetch('/api/gamification/code', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ code: inviteCode })
               });
            } catch (e) {}
         }
         setErrorMsg('Cadastro realizado! Se o e-mail não tiver confirmação, já pode fazer o login.');
         setLoading(false);
         // Opcional: setIsRegister(false) para forçar o login agora
       }
    } else {
       const { error } = await supabase.auth.signInWithPassword({ email, password });
       if (error) {
         setErrorMsg('E-mail ou senha incorretos.');
         setLoading(false);
       } else {
         router.push('/painel-master');
         router.refresh();
       }
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050505] p-4 font-sans selection:bg-[#00ff41]/30 relative overflow-hidden">
      
      {/* Luz ambiente de fundo (Glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00ff41]/[0.06] blur-[100px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#e51e3e]/[0.03] blur-[80px] rounded-full pointer-events-none z-0 translate-x-[30%] -translate-y-[30%]"></div>

      {/* Container Principal (Card Premium Glassmorphism com Aura Verde) */}
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
              {/* Seta Verde */}
              <path d="M50 15 L80 65 L70 65 L50 30 L30 65 L20 65 Z" fill="#00ff41" filter="url(#glow-green)" />
              {/* Seta Vermelha */}
              <path d="M45 45 L75 60 L45 75 L45 65 L60 60 L45 55 Z" fill="#e51e3e" filter="url(#glow-red)" />
            </svg>
          </div>
          <h1 className="text-xl font-mono tracking-[0.2em] text-white font-light drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] flex gap-2">
            <span className="text-[#00ff41]">APEX</span>
            <span className="text-[#e51e3e]">MACHINE</span>
          </h1>
        </div>

        {/* Subtítulo com Ícone */}
        <div className="flex items-center gap-2 text-white/40 text-xs font-mono tracking-widest mb-8">
          <Cpu size={14} className="text-[#00ff41]" />
          <span>SISTEMA DE ANÁLISES</span>
        </div>

        {errorMsg && (
           <div className={`w-full border text-xs text-center py-2.5 px-4 rounded-xl mb-5 font-mono shadow-sm
              ${errorMsg.includes('Cadastro') ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}
           `}>
              {errorMsg}
           </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          
          {/* Input Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#00ff41] transition-colors">
                <Mail size={16} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Digite seu email"
                className="w-full bg-black/50 border border-white/10 hover:border-white/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00ff41]/50 focus:bg-[#00ff41]/[0.02] transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
              />
            </div>
          </div>

          {/* Input Senha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Senha</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#00ff41] transition-colors">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
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

          {/* Input Confirmar Senha */}
          {isRegister && (
            <>
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Confirmar Senha</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#00ff41] transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  className="w-full bg-black/50 border border-white/10 hover:border-white/20 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00ff41]/50 focus:bg-[#00ff41]/[0.02] transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300 mt-2">
              <label className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Código VIP (Opcional)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-[#00ff41] transition-colors">
                  <Gift size={16} />
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Tem um código promocional?"
                  className="w-full bg-black/50 border border-white/10 hover:border-white/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#00ff41]/50 focus:bg-[#00ff41]/[0.02] transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] uppercase"
                />
              </div>
            </div>
          </>
          )}

          {/* Links e Termos */}
          {!isRegister ? (
            <div className="flex justify-end -mt-1">
              <Link href="/recuperar-senha" className="text-xs font-mono text-white/40 hover:underline hover:text-[#00ff41] transition-colors">
                Esqueci minha senha
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <input type="checkbox" required className="accent-[#00ff41] w-3 h-3 cursor-pointer" />
              <span className="text-[10px] font-mono text-white/40">
                Li e concordo com os <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00ff41] underline underline-offset-2">Termos</a> e <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#00ff41] underline underline-offset-2">Privacidade</a>
              </span>
            </div>
          )}

          {/* Botão Principal */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full bg-[#00ff41]/10 border border-[#00ff41]/50 hover:bg-[#00ff41]/20 hover:border-[#00ff41] text-[#00ff41] font-mono tracking-widest font-bold text-xs py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(0,255,65,0.1)] hover:shadow-[0_0_25px_rgba(0,255,65,0.25)] disabled:opacity-70 flex justify-center items-center mt-2 overflow-hidden group uppercase"
          >
            <div className="absolute inset-0 bg-[#00ff41]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            <span className="relative z-10 drop-shadow-[0_0_8px_rgba(0,255,65,0.5)]">
              {loading ? 'Processando...' : (isRegister ? 'Criar minha conta' : 'Entrar')}
            </span>
          </button>

          {/* Divisor OU */}
          <div className="flex items-center gap-3 my-1 opacity-60">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-white/30 font-mono text-[9px] uppercase font-bold tracking-widest">ou</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Botão Secundário (Toggle) */}
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="w-full bg-black/30 hover:bg-white/5 border border-white/5 hover:border-white/10 text-white/70 font-mono tracking-widest font-bold text-xs py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 uppercase"
          >
            {isRegister ? (
              'Já tenho uma conta'
            ) : (
              <>
                <UserPlus size={14} className="text-white/40" />
                Criar conta gratuita
              </>
            )}
          </button>

        </form>
      </div>

      {/* Botão de Suporte Flutuante (Abaixo do Card) */}
      <a 
        href="https://t.me/seusuporte" 
        target="_blank" 
        rel="noreferrer" 
        className="mt-8 relative z-10 flex items-center gap-2 px-5 py-2.5 bg-black/40 backdrop-blur-md border border-white/5 hover:border-[#00ff41]/50 hover:bg-white/5 text-white/50 hover:text-[#00ff41] rounded-full text-xs font-mono tracking-widest font-bold transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] group uppercase"
      >
        <Send size={14} className="mb-[1px] opacity-70 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
        Fale com nosso suporte
      </a>

      {/* Rodapé Invisível (Apenas para fechar o layout) */}
      <div className="mt-6 text-[10px] text-[#4A5468] font-medium flex gap-1">
        Versão 1.0.0
      </div>

    </main>
  );
}
