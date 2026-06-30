'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanosPage() {
  const [loading, setLoading] = useState<string | null>(null);

  // Aqui você vai colar os IDs gerados no Stripe para cada plano
  const PLANS = [
    {
      id: 'diario',
      name: 'Passe Diário',
      days: 1,
      price: '5',
      stripePriceId: 'price_1To6Vp630gqKt3w8p246HmHQ',
      description: 'Ideal para testar a assertividade da IA em um dia de operações.',
      recommended: false,
    },
    {
      id: 'semanal',
      name: 'Acesso Semanal',
      days: 7,
      price: '15',
      stripePriceId: 'price_1To6W6630gqKt3w8Sjp0fcxI',
      description: 'Uma semana completa com todos os sinais do Painel Master.',
      recommended: false,
    },
    {
      id: 'quinzenal',
      name: 'Acesso Quinzenal',
      days: 15,
      price: '35',
      stripePriceId: 'price_1To6WS630gqKt3w8csHOOm9c',
      description: 'Quinze dias para construir seu histórico de lucros sem pressa.',
      recommended: false,
    },
    {
      id: 'mensal',
      name: 'Passe Apex Mensal',
      days: 30,
      price: '50',
      stripePriceId: 'price_1To6Wi630gqKt3w84c7usskg',
      description: 'O melhor custo-benefício. Acesso VIP durante todo o mês.',
      recommended: true,
    }
  ];

  const handleCheckout = async (priceId: string, days: number) => {
    setLoading(priceId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, days }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Erro ao iniciar o pagamento.');
        setLoading(null);
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center py-16 px-4 font-sans">
      <div className="max-w-6xl w-full text-center space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          Escolha seu arsenal de operações
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Desbloqueie o potencial máximo do Apex Machine. Sem limites, sem delay, 100% de performance analítica no tempo exato que você precisa.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 text-left">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`relative bg-[#0b0c10] border ${plan.recommended ? 'border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'border-gray-800'} rounded-2xl p-6 flex flex-col transition-transform hover:-translate-y-1`}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0 bg-blue-600 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
                  MAIS ESCOLHIDO
                </div>
              )}
              
              <h2 className={`text-xl font-bold mb-2 ${plan.recommended ? 'text-blue-400' : 'text-gray-100'}`}>
                {plan.name}
              </h2>
              <p className="text-gray-500 text-sm mb-6 h-10">{plan.description}</p>
              
              <div className="text-4xl font-bold mb-6">
                R$ {plan.price}
                <span className="text-sm text-gray-500 font-normal block mt-1">
                  por {plan.days} {plan.days === 1 ? 'dia' : 'dias'}
                </span>
              </div>
              
              <ul className="space-y-3 mb-8 flex-grow text-sm">
                <li className="flex items-start text-gray-300">
                  <span className="text-blue-500 mr-2 font-bold">✓</span> Sinais em Tempo Real
                </li>
                <li className="flex items-start text-gray-300">
                  <span className="text-blue-500 mr-2 font-bold">✓</span> Filtros Avançados
                </li>
                <li className="flex items-start text-gray-300">
                  <span className="text-blue-500 mr-2 font-bold">✓</span> Simulador e Histórico
                </li>
              </ul>
              
              <button 
                onClick={() => handleCheckout(plan.stripePriceId, plan.days)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-lg font-bold transition-colors ${
                  plan.recommended 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                } disabled:opacity-50`}
              >
                {loading === plan.stripePriceId ? 'Iniciando...' : 'Assinar Agora'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
