'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User, LogOut, Key, ShieldCheck, Mail, CreditCard, ChevronRight, Gift, Dices } from 'lucide-react';

export default function MinhaContaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Gamification States
  const [code, setCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMsg, setCodeMsg] = useState({ text: '', type: '' });
  
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<any>(null);
  const [canSpin, setCanSpin] = useState(false);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         setUser(user);
         const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
         if (prof) {
            setProfile(prof);
            const lastSpin = prof.last_roulette_spin ? new Date(prof.last_roulette_spin) : null;
            if (!lastSpin || (new Date().getTime() - lastSpin.getTime() > 24 * 60 * 60 * 1000)) {
               setCanSpin(true);
            }
         }
      }
      setLoading(false);
    }
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleRedeemCode = async () => {
    if (!code) return;
    setCodeLoading(true);
    setCodeMsg({ text: '', type: '' });
    
    try {
      const res = await fetch('/api/gamification/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setCodeMsg({ text: data.message, type: 'success' });
      setCode('');
    } catch (err: any) {
      setCodeMsg({ text: err.message, type: 'error' });
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSpinRoulette = async () => {
    if (!canSpin || rouletteSpinning) return;
    setRouletteSpinning(true);
    setRouletteResult(null);
    
    // Simulate spinning delay for excitement
    await new Promise(r => setTimeout(r, 2000));
    
    try {
      const res = await fetch('/api/gamification/roulette', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setRouletteResult(data);
      setCanSpin(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRouletteSpinning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050507]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00c83a]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] p-6 flex flex-col items-center justify-center relative overflow-hidden pb-32">
      
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#00c83a]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00c83a]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0f141e]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative z-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] mt-10">
        
        {/* Header / Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00c83a] to-[#00ff41] flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(0,255,65,0.3)] border-2 border-black">
            <User size={36} className="text-black" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-1">Sua Conta</h1>
          <p className="text-sm text-gray-400 font-medium">Gerencie suas configurações e assinatura</p>
        </div>

        {/* Info Cards */}
        <div className="flex flex-col gap-3 mb-8">
          <div className="flex items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/5 transition-colors hover:border-white/10">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <Mail size={18} className="text-gray-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Email Cadastrado</span>
              <span className="text-sm text-white font-medium">{user?.email || 'Usuário Local / Demo'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#00c83a]/5 p-4 rounded-xl border border-[#00c83a]/30 relative overflow-hidden transition-all hover:border-[#00c83a]/50 hover:shadow-[0_0_15px_rgba(0,200,58,0.15)]">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#00c83a]/10 rounded-full blur-2xl -mr-10 -mt-10" />
             <div className="w-10 h-10 rounded-lg bg-[#00c83a]/10 flex items-center justify-center shrink-0 border border-[#00c83a]/30 relative z-10">
               <ShieldCheck size={18} className="text-[#00c83a]" />
             </div>
             <div className="flex flex-col relative z-10">
               <span className="text-[10px] uppercase font-bold text-[#00c83a] tracking-wider">Plano Atual</span>
               <span className="text-sm text-white font-black uppercase">Acesso Premium</span>
             </div>
             <div className="ml-auto relative z-10 bg-[#00c83a] text-black text-[10px] font-black uppercase px-2.5 py-1 rounded shadow-[0_0_8px_rgba(0,200,58,0.4)]">Ativo</div>
          </div>
        </div>

        {/* Gamification Section */}
        <div className="flex flex-col gap-4 mb-8">
           {/* Resgate de Código */}
           <div className="bg-black/30 border border-white/5 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                 <Gift size={16} className="text-[#00c83a]" />
                 <span className="text-[11px] uppercase font-bold text-gray-400 tracking-widest">Resgatar Código / Cupom</span>
              </div>
              <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={code}
                   onChange={(e) => setCode(e.target.value.toUpperCase())}
                   placeholder="Insira seu código..."
                   className="flex-1 bg-[#0f141e] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00c83a]/50"
                 />
                 <button 
                   onClick={handleRedeemCode}
                   disabled={codeLoading || !code}
                   className="bg-[#00c83a]/20 text-[#00c83a] border border-[#00c83a]/30 hover:bg-[#00c83a]/30 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                 >
                   {codeLoading ? '...' : 'Aplicar'}
                 </button>
              </div>
              {codeMsg.text && (
                 <div className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${codeMsg.type === 'success' ? 'text-[#00c83a]' : 'text-red-400'}`}>
                    {codeMsg.text}
                 </div>
              )}
           </div>

           {/* Roleta Diária (Em Breve) */}
           <div className="bg-gradient-to-br from-[#1a1c23] to-[#0f141e] border border-white/5 p-5 rounded-2xl relative overflow-hidden opacity-60">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10" />
              
              <div className="flex flex-col items-center justify-center relative z-10 text-center">
                 <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3 bg-gray-800/50 text-gray-500">
                    <Dices size={24} />
                 </div>
                 
                 <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                    Roleta da Sorte
                    <span className="bg-red-500/20 border border-red-500/50 text-red-400 text-[8px] px-1.5 py-0.5 rounded shadow-sm">EM BREVE</span>
                 </h3>
                 
                 <p className="text-[10px] text-gray-400 font-medium mb-4 px-4">
                    Estamos reformulando nosso sistema de prêmios e bônus. A roleta voltará em breve com recompensas ainda melhores!
                 </p>

                 <button 
                   disabled
                   className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed"
                 >
                   Bloqueado Temporariamente
                 </button>
              </div>
           </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => {
              router.push('/nova-senha');
            }}
            className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center gap-3 text-gray-300 group-hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                <Key size={16} />
              </div>
              <span className="text-sm font-semibold">Trocar de Senha</span>
            </div>
            <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
          </button>

          <a 
            href="/planos"
            className="flex items-center justify-between w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center gap-3 text-gray-300 group-hover:text-white transition-colors">
              <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                <CreditCard size={16} />
              </div>
              <span className="text-sm font-semibold">Renovar Assinatura</span>
            </div>
            <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
          </a>
          
          <div className="h-[1px] bg-white/10 my-3" />

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-bold text-sm hover:bg-red-500/20 hover:text-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all"
          >
            <LogOut size={18} />
            Sair da Conta
          </button>
        </div>

      </div>
    </div>
  );
}
