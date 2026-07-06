'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, LayoutDashboard, ArrowRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);

  const isSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    if (!isSuccess) {
      router.replace('/planos');
      return;
    }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/painel-master');
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSuccess, router]);

  if (!isSuccess) return null;

  return (
    <main className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#00c83a]/[0.07] blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center text-center max-w-lg gap-8"
      >
        {/* Ícone de sucesso */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#00c83a]/20 animate-ping" />
          <div className="w-24 h-24 rounded-full bg-[#00c83a]/10 border-2 border-[#00c83a] flex items-center justify-center relative shadow-[0_0_40px_rgba(0,200,58,0.3)]">
            <CheckCircle size={48} className="text-[#00c83a]" />
          </div>
        </div>

        {/* Texto */}
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#00c83a]">
            Pagamento Confirmado
          </span>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white leading-tight">
            Bem-vindo ao <span className="text-[#00c83a]">Terminal</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Seu acesso Premium foi ativado com sucesso. Você já pode usar todas as ferramentas do Apex Machine.
          </p>
        </div>

        {/* Cards de features */}
        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          {[
            { label: 'Radar ao Vivo', desc: 'Sinais em tempo real' },
            { label: 'Backtester', desc: '43k rodadas históricas' },
            { label: 'Minutos da IA', desc: 'Confluência inteligente' },
            { label: 'Mestre de Confluência', desc: 'Gatilhos automáticos' },
          ].map((f) => (
            <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-left hover:border-[#00c83a]/30 transition-colors">
              <Zap size={14} className="text-[#00c83a] mb-1" />
              <div className="text-[11px] font-black uppercase tracking-wider text-white">{f.label}</div>
              <div className="text-[10px] text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Botão e contador */}
        <div className="flex flex-col items-center gap-3 w-full">
          <Link
            href="/painel-master"
            className="w-full py-4 bg-[#00c83a] hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 shadow-[0_0_30px_rgba(0,200,58,0.3)] flex items-center justify-center gap-3"
          >
            <LayoutDashboard size={18} />
            Acessar o Terminal Agora
            <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-gray-600">
            Redirecionando automaticamente em <span className="text-[#00c83a] font-black">{countdown}s</span>
          </p>
        </div>
      </motion.div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">Carregando...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
