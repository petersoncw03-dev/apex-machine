'use client';

import React, { useState } from 'react';
import { CheckCircle, Zap, Shield, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const PLANS = [
  {
    id: 'diario',
    name: 'Passe Diário',
    days: 1,
    price: 5,
    priceStr: 'R$ 5',
    description: 'Ideal para testar a assertividade da IA em um dia de operações.',
    recommended: false,
    features: ['Sinais em Tempo Real', 'Painel Master', 'Filtros Avançados'],
  },
  {
    id: 'semanal',
    name: 'Acesso Semanal',
    days: 7,
    price: 15,
    priceStr: 'R$ 15',
    description: 'Uma semana completa com todos os sinais do Painel Master.',
    recommended: false,
    features: ['Sinais em Tempo Real', 'Painel Master', 'Filtros Avançados', 'Simulador e Histórico'],
  },
  {
    id: 'quinzenal',
    name: 'Acesso Quinzenal',
    days: 15,
    price: 35,
    priceStr: 'R$ 35',
    description: 'Quinze dias para construir seu histórico de lucros sem pressa.',
    recommended: false,
    features: ['Sinais em Tempo Real', 'Painel Master', 'Filtros Avançados', 'Simulador e Histórico', 'IA Analista'],
  },
  {
    id: 'mensal',
    name: 'Passe Apex Mensal',
    days: 30,
    price: 50,
    priceStr: 'R$ 50',
    description: 'O melhor custo-benefício. Acesso VIP durante todo o mês.',
    recommended: true,
    features: ['Sinais em Tempo Real', 'Painel Master', 'Filtros Avançados', 'Simulador e Histórico', 'IA Analista', 'Suporte Prioritário'],
  },
];

export default function PlanosPage() {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (days: number) => {
    setLoading(days);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('Você precisa estar logado para assinar um plano.');
        setLoading(null);
        return;
      }

      const res = await fetch('/api/mercadopago/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ days }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setError('Você precisa estar logado para assinar um plano.');
        setLoading(null);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Erro ao iniciar o pagamento. Tente novamente.');
        setLoading(null);
      }
    } catch (err) {
      console.error(err);
      setError('Erro inesperado. Verifique sua conexão e tente novamente.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center py-16 px-4 font-sans">
      {/* Header */}
      <div className="max-w-4xl w-full text-center mb-14 space-y-4">
        <div className="inline-flex items-center gap-2 bg-[#00ff41]/10 border border-[#00ff41]/20 text-[#00ff41] text-xs font-bold px-4 py-1.5 rounded-full font-mono tracking-widest uppercase mb-2">
          <Zap size={12} />
          Pix · Cartão · Google Pay
        </div>
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent leading-tight">
          Escolha seu arsenal
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Desbloqueie o potencial máximo do Apex Machine. Pagamento 100% brasileiro — Pix, Cartão e Google Pay.
        </p>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="max-w-6xl w-full grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl p-6 transition-all duration-300 ${
              plan.recommended
                ? 'bg-[#0b0e14] border border-[#00ff41] shadow-[0_0_30px_rgba(0,255,65,0.05)] md:scale-105 z-10'
                : 'bg-[#0b0e14] border border-white/[0.05] hover:border-white/10'
            }`}
          >
            {plan.recommended && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00ff41] text-black text-[9px] sm:text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest uppercase shadow-[0_0_15px_rgba(0,255,65,0.5)] whitespace-nowrap">
                Mais Escolhido
              </div>
            )}

            <div className="mb-6 mt-2">
              <h2 className={`text-xl font-black mb-1.5 tracking-wider uppercase ${plan.recommended ? 'text-[#00ff41]' : 'text-white'}`}>
                {plan.name}
              </h2>
              <p className="text-gray-500 text-[13px] leading-relaxed">{plan.description}</p>
            </div>

            <div className="mb-8 flex items-baseline gap-1">
              <span className="text-gray-400 font-bold text-sm">R$</span>
              <span className={`text-5xl font-black tracking-tighter ${plan.recommended ? 'text-white' : 'text-white'}`}>
                {plan.price}
              </span>
              <span className="text-gray-500 font-medium text-xs ml-1">
                / {plan.days} {plan.days === 1 ? 'dia' : 'dias'}
              </span>
            </div>

            <ul className="flex-grow space-y-4 mb-10">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                  <CheckCircle size={18} className="text-[#00ff41] shrink-0 mt-0.5" />
                  <span className="leading-tight">{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.days)}
              disabled={loading !== null}
              className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 ${
                plan.recommended
                  ? 'bg-[#00ff41] hover:bg-[#00dd38] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]'
                  : 'bg-[#12141c] hover:bg-[#1a1d24] border border-white/5 hover:border-white/10 text-white'
              }`}
            >
              {loading === plan.days ? 'Aguarde...' : 'Garantir Acesso'}
            </button>
          </div>
        ))}
      </div>

      {/* Trust badges */}
      <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-gray-600 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-[#00ff41]" />
          Pagamento 100% Seguro
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-[#00ff41]" />
          Acesso Imediato após Pagamento
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-[#00ff41]" />
          Pix · Cartão · Google Pay
        </div>
      </div>
    </div>
  );
}
