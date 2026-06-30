'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ChevronRight, 
  Target, 
  Activity, 
  Cpu, 
  ShieldCheck, 
  Radio, 
  Flame, 
  BarChart2, 
  Zap,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function VendasPage() {
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const scrollToPlanos = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });
  };

  const PLANS = [
    {
      id: 'diario',
      name: 'Passe Diário',
      days: 1,
      price: '5',
      stripePriceId: 'price_1To6Vp630gqKt3w8p246HmHQ',
      description: 'Teste a assertividade em 24 horas.',
      recommended: false,
    },
    {
      id: 'semanal',
      name: 'Acesso Semanal',
      days: 7,
      price: '15',
      stripePriceId: 'price_1To6W6630gqKt3w8Sjp0fcxI',
      description: 'Uma semana inteira de sinais VIP.',
      recommended: false,
    },
    {
      id: 'quinzenal',
      name: 'Acesso Quinzenal',
      days: 15,
      price: '35',
      stripePriceId: 'price_1To6WS630gqKt3w8csHOOm9c',
      description: 'Tempo ideal para criar consistência.',
      recommended: false,
    },
    {
      id: 'mensal',
      name: 'Passe Mensal',
      days: 30,
      price: '50',
      stripePriceId: 'price_1To6Wi630gqKt3w84c7usskg',
      description: 'O melhor custo-benefício (30 dias).',
      recommended: true,
    }
  ];

  const handleCheckout = async (priceId: string, days: number) => {
    setLoading(priceId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="min-h-screen bg-[#050507] text-gray-200 font-sans selection:bg-[#00c83a]/30 relative overflow-x-hidden">
      {/* Background Matrix/Cyber Vibe */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 z-0 pointer-events-none"></div>
      
      {/* Luzes de fundo globais */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#00c83a]/[0.03] blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-[#f12c4c]/[0.02] blur-[150px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#eab308]/[0.02] blur-[150px] rounded-full pointer-events-none z-0"></div>

      {/* HEADER FIXO */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)]' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded bg-[#12141c] border border-white/10 flex items-center justify-center group-hover:border-[#00c83a]/50 transition-colors">
              <Cpu size={16} className="text-[#00c83a]" />
            </div>
            <h1 className="text-xl font-black tracking-tighter flex gap-1 uppercase">
              <span className="text-white">APEX</span>
              <span className="text-gray-500 font-light">MACHINE</span>
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-bold tracking-widest text-white uppercase rounded-lg transition-all flex items-center gap-2">
              <Lock size={14} className="text-gray-400" />
              Acesso ao Terminal
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20 z-10">
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#eab308]/10 border border-[#eab308]/30 text-[10px] font-black uppercase tracking-widest text-[#eab308] mb-8 shadow-[0_0_20px_rgba(234,179,8,0.15)]"
          >
            <Activity size={14} />
            <span>Terminal Institucional de Alta Frequência</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.1] mb-6 text-white uppercase"
          >
            Pare de jogar. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c83a] to-emerald-600 drop-shadow-[0_0_30px_rgba(0,200,58,0.3)]">
              Comece a operar.
            </span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl mx-auto mb-12"
          >
            O Apex Machine não é um "robô de sinais". É o primeiro Terminal Analítico projetado para monitorar ciclos invisíveis e calcular confluências matemáticas em tempo real na Roleta.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto"
          >
            <button 
              onClick={scrollToPlanos}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#00c83a] to-emerald-600 hover:from-[#00e044] hover:to-emerald-500 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(0,200,58,0.4)] flex items-center justify-center gap-2"
            >
              Ver Licenças Disponíveis
              <ChevronRight size={18} />
            </button>
          </motion.div>
        </div>

        {/* HERO MOCKUP (DASHBOARD PREVIEW) */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="w-full max-w-6xl mx-auto mt-20 relative"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00c83a]/30 via-[#f12c4c]/30 to-[#eab308]/30 blur-2xl opacity-20"></div>
          <div className="relative bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden aspect-video flex flex-col">
            {/* Fake Header do Terminal */}
            <div className="h-12 bg-[#050507] border-b border-white/5 flex items-center px-6 gap-6">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              </div>
              <div className="flex gap-4 text-sm font-black text-white tracking-widest uppercase">
                Estratégias Ao Vivo
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00c83a] animate-pulse"></div>
                <span className="text-[10px] uppercase font-bold text-[#00c83a] tracking-widest">WebSocket 14ms</span>
              </div>
            </div>
            
            {/* Fake Body - High Fidelity Table Replica */}
            <div className="flex-1 bg-[#0a0a0f] flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] text-[10px] font-black text-gray-400 uppercase tracking-widest py-4 px-6 border-b border-white/5 bg-[#12141c]/50">
                <div className="text-center">Padrão</div>
                <div className="text-center">TX % ↓</div>
                <div className="text-center">WIN</div>
                <div className="text-center">LOSS</div>
                <div className="text-center">PNL</div>
                <div className="text-center">SM</div>
                <div className="text-center">SA</div>
              </div>
              
              {/* Table Rows */}
              <div className="flex flex-col py-2">
                {[
                  { pattern: [null, {c:'red', v:2}, null], tx: '100.0%', w: 1, l: 0, pnl: '13' },
                  { pattern: [null, {c:'red', v:14}, {c:'black', v:14}], tx: '100.0%', w: 1, l: 0, pnl: '13' },
                  { pattern: [{c:'black', v:13}, {c:'red', v:14}, null], tx: '100.0%', w: 1, l: 0, pnl: '13' },
                  { pattern: [{c:'black', v:8}, null, {c:'red', v:null}], tx: '100.0%', w: 1, l: 0, pnl: '13' },
                  { pattern: [null, {c:'black', v:9}, null, {c:'red', v:null}], tx: '100.0%', w: 2, l: 0, pnl: '26' },
                  { pattern: [null, {c:'black', v:9}, {c:'red', v:14}], tx: '100.0%', w: 1, l: 0, pnl: '13' },
                ].map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] items-center text-xs font-bold py-3 px-6 hover:bg-white/[0.02] transition-colors border-b border-white/[0.02]">
                    <div className="flex gap-1.5 justify-center">
                      {row.pattern.map((p, pIdx) => (
                        <div key={pIdx} className={`w-7 h-7 rounded flex items-center justify-center text-[10px] shadow-sm ${
                          p === null ? 'bg-[#1a1b26] border border-white/5' : 
                          p.c === 'red' ? 'bg-[#f12c4c] text-white shadow-[0_0_10px_rgba(241,44,76,0.3)]' : 
                          'bg-[#262831] text-white border border-white/10'
                        }`}>
                          {p?.v || ''}
                        </div>
                      ))}
                    </div>
                    <div className="text-[#00c83a] text-center">{row.tx}</div>
                    <div className="text-white text-center">{row.w}</div>
                    <div className="text-gray-500 text-center">{row.l}</div>
                    <div className="text-[#00c83a] text-center font-black">R$ {row.pnl}</div>
                    <div className="text-gray-400 text-center">0</div>
                    <div className="text-gray-400 text-center">0</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-auto bg-gradient-to-t from-[#050507] to-transparent h-16 w-full absolute bottom-0 pointer-events-none"></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* PAIN & SOLUTION */}
      <section className="py-24 px-6 relative z-10 bg-[#020203]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-6">
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white leading-tight">
              A maioria opera <span className="text-[#f12c4c]">no escuro</span>.
            </h3>
            <p className="text-gray-400 text-lg leading-relaxed">
              Você usa robôs de Telegram gratuitos que mandam o mesmo sinal para milhares de pessoas com atraso? Você anota padrões no papel?
            </p>
            <p className="text-gray-400 text-lg leading-relaxed">
              Enquanto o mercado amador joga contando com a sorte, os institucionais operam baseados em ingestão de dados massiva, latência zero e processamento simultâneo.
            </p>
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-[#00c83a]/10 border border-[#00c83a]/20 text-[#00c83a] font-bold text-sm uppercase tracking-widest w-fit mt-4">
              <ShieldCheck size={20} />
              Nós trouxemos a luz.
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <Radio className="text-[#00c83a]" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Latência &lt; 150ms</h4>
              <p className="text-xs text-gray-500">Conexão WebSocket direta com os servidores. O sinal pisca na tela milissegundos após a pedra girar.</p>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <Cpu className="text-[#eab308]" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Processamento IA</h4>
              <p className="text-xs text-gray-500">Avaliamos mais de 50 variáveis por segundo para encontrar o exato momento de ruptura.</p>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <BarChart2 className="text-purple-500" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Confluências</h4>
              <p className="text-xs text-gray-500">O sistema só emite alerta quando +5 estratégias profissionais concordam simultaneamente.</p>
            </div>
            <div className="bg-[#0a0a0f] border border-[#f12c4c]/20 p-6 rounded-xl flex flex-col gap-3 hover:border-[#f12c4c]/40 transition-all shadow-[0_0_15px_rgba(241,44,76,0.05)]">
              <Flame className="text-[#f12c4c]" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Radar REC</h4>
              <p className="text-xs text-gray-500">Nossa IA avisa exatamente quando a mesa entra em fase de recuperação, evitando que você devolva o lucro.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DEEP DIVE FEATURES */}
      <section id="funcionalidades" className="py-32 px-6 relative z-10 border-t border-white/5 bg-gradient-to-b from-[#050507] to-[#0a0a0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Módulos de <span className="text-[#00c83a]">Alta Performance</span>
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Cada módulo do Apex Machine substitui dezenas de ferramentas avulsas, unificando tudo em um terminal de comando hiper-rápido.
            </p>
          </div>

          <div className="flex flex-col gap-24">
            
            {/* Mod 1 */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 flex flex-col gap-4 order-2 md:order-1">
                <div className="px-3 py-1 bg-[#8b008b]/10 border border-[#8b008b]/30 text-[#d8b4e2] text-[10px] font-black uppercase tracking-widest rounded-md w-fit">Radar Avançado</div>
                <h4 className="text-3xl font-black uppercase text-white tracking-tight">O Fim das "Entradas no Achismo"</h4>
                <p className="text-gray-400">O Radar Avançado cruza padrões ao vivo, calculando o TX (Taxa de Acerto), o SA (Streak Atual) e o SM (Streak Máxima) de cada estratégia, disparando um alerta visual e sonoro apenas quando a probabilidade matemática está a seu favor.</p>
                <ul className="flex flex-col gap-3 mt-4">
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Histórico infinito real-time.</li>
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Filtragem de Confluências Máximas.</li>
                </ul>
              </div>
              <div className="flex-1 w-full aspect-video bg-[#12141c] border border-white/10 rounded-2xl p-6 shadow-2xl relative order-1 md:order-2 overflow-hidden flex items-center justify-center">
                 <div className="absolute inset-0 bg-gradient-to-tr from-[#8b008b]/10 to-transparent"></div>
                 <div className="text-center">
                    <Radio size={64} className="text-[#8b008b] opacity-50 mb-4 mx-auto" />
                    <span className="font-mono text-gray-500 uppercase tracking-widest text-xs">Visualização do Radar</span>
                 </div>
              </div>
            </div>

            {/* Mod 2 */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 w-full aspect-video bg-[#12141c] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex items-center justify-center">
                 <div className="absolute inset-0 bg-gradient-to-tr from-[#00c83a]/10 to-transparent"></div>
                 <div className="text-center">
                    <Activity size={64} className="text-[#00c83a] opacity-50 mb-4 mx-auto" />
                    <span className="font-mono text-gray-500 uppercase tracking-widest text-xs">Simulador Time-Machine</span>
                 </div>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <div className="px-3 py-1 bg-[#00c83a]/10 border border-[#00c83a]/30 text-[#4ade80] text-[10px] font-black uppercase tracking-widest rounded-md w-fit">Time-Machine Backtester</div>
                <h4 className="text-3xl font-black uppercase text-white tracking-tight">Viagem no Tempo Matemática</h4>
                <p className="text-gray-400">Desenvolveu uma estratégia nova? Não teste com seu dinheiro real. Jogue ela na nossa Máquina do Tempo. O sistema simula o comportamento do seu robô pelas últimas 43.200 rodadas em questão de segundos e te entrega o PNL final exato.</p>
                <ul className="flex flex-col gap-3 mt-4">
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Validação Imediata.</li>
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Relatórios precisos de drawndown.</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ESTATÍSTICAS / SOCIAL PROOF */}
      <section className="py-16 px-6 border-y border-[#00c83a]/20 bg-[#00c83a]/5 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-around gap-8 text-center">
          <div className="flex flex-col items-center gap-2">
             <span className="text-5xl font-black text-white">+43.200</span>
             <span className="text-[10px] uppercase font-black tracking-widest text-[#00c83a]">Rodadas Analisadas / Dia</span>
          </div>
          <div className="flex flex-col items-center gap-2">
             <span className="text-5xl font-black text-white">99.9%</span>
             <span className="text-[10px] uppercase font-black tracking-widest text-[#00c83a]">Uptime dos Servidores</span>
          </div>
          <div className="flex flex-col items-center gap-2">
             <span className="text-5xl font-black text-white">&lt;150ms</span>
             <span className="text-[10px] uppercase font-black tracking-widest text-[#00c83a]">Latência de Ingestão</span>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-32 px-6 relative z-10 bg-[#050507]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Escolha seu <span className="text-[#eab308]">Arsenal</span>
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Selecione o nível de acesso ao terminal que mais se adequa ao seu volume operacional. Vagas estritamente limitadas para garantir a estabilidade do WebSocket.
            </p>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center max-w-7xl mx-auto">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`relative bg-[#0a0a0f] border ${plan.recommended ? 'border-[#00c83a] shadow-[0_10px_30px_rgba(0,200,58,0.15)] transform md:-translate-y-4' : 'border-white/10 hover:border-white/30'} rounded-2xl p-8 flex flex-col gap-6 transition-all h-full`}
            >
               {plan.recommended && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00c83a] text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">
                   Melhor Custo Benefício
                 </div>
               )}
               <div className="flex flex-col gap-1">
                 <h4 className={`text-lg font-black uppercase tracking-widest ${plan.recommended ? 'text-[#00c83a]' : 'text-white'}`}>{plan.name}</h4>
                 <p className="text-xs text-gray-500 min-h-[32px]">{plan.description}</p>
               </div>
               <div className="flex items-end gap-1">
                 <span className="text-sm font-bold text-gray-400 mb-2">R$</span>
                 <span className="text-4xl font-black text-white">{plan.price}</span>
                 <span className="text-xs font-bold text-gray-500 mb-2">/ {plan.days === 1 ? 'dia' : `${plan.days} dias`}</span>
               </div>
               <ul className="flex flex-col gap-4 text-sm font-medium text-gray-300 mt-2 border-t border-white/5 pt-6 flex-1">
                 <li className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#00c83a]" /> Sinais em Tempo Real</li>
                 <li className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#00c83a]" /> Todos os Radares (Confluências)</li>
                 <li className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#00c83a]" /> Simulador (Backtester)</li>
               </ul>
               <button 
                 onClick={() => handleCheckout(plan.stripePriceId, plan.days)}
                 disabled={loading !== null}
                 className={`mt-4 w-full py-4 font-black text-xs uppercase tracking-widest rounded-xl transition-all ${
                   plan.recommended 
                    ? 'bg-[#00c83a] hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(0,200,58,0.3)] hover:scale-105' 
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white hover:border-white/20'
                 } disabled:opacity-50`}
               >
                 {loading === plan.stripePriceId ? 'Processando...' : 'Garantir Acesso'}
               </button>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <Cpu size={48} className="text-[#00c83a] mb-6 opacity-50" />
          <h3 className="text-4xl md:text-5xl font-black uppercase text-white tracking-tighter mb-6">
            O terminal está <span className="text-[#00c83a]">pronto</span>.
          </h3>
          <p className="text-gray-400 text-lg mb-10 max-w-xl">
            Pare de depender da sorte e coloque a matemática institucional para trabalhar a seu favor agora mesmo.
          </p>
          <button 
            onClick={scrollToPlanos}
            className="px-10 py-5 bg-white text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-3"
          >
            Quero fazer parte da Elite
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 bg-[#020203] text-center relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Cpu size={14} className="text-white" />
            <span className="text-sm font-black tracking-widest text-white uppercase">APEX MACHINE</span>
          </div>
          <p className="text-xs text-gray-600 max-w-2xl mx-auto">
            Apex Machine é um terminal analítico focado em estatística e probabilidade. Não garantimos ganhos financeiros. Operações financeiras envolvem riscos. 
          </p>
          <div className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mt-4">
            © {new Date().getFullYear()} APEX MACHINE. TODOS OS DIREITOS RESERVADOS.
          </div>
        </div>
      </footer>
    </main>
  );
}
