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
  ArrowRight,
  LayoutDashboard,
  Mail,
  MessageCircle,
  HelpCircle,
  Eye,
  Crosshair,
  TrendingUp,
  BrainCircuit
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
      description: 'Teste a assertividade em 24 horas.',
      recommended: false,
    },
    {
      id: 'semanal',
      name: 'Acesso Semanal',
      days: 7,
      price: '15',
      description: 'Uma semana inteira de análise profunda.',
      recommended: false,
    },
    {
      id: 'quinzenal',
      name: 'Acesso Quinzenal',
      days: 15,
      price: '35',
      description: 'Tempo ideal para criar método e consistência.',
      recommended: false,
    },
    {
      id: 'mensal',
      name: 'Passe Mensal',
      days: 30,
      price: '50',
      description: 'O melhor custo-benefício (30 dias).',
      recommended: true,
    }
  ];

  const handleCheckout = async (days: number) => {
    setLoading(String(days));
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = '/login?redirect=/planos';
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

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Erro ao iniciar o pagamento.');
        setLoading(null);
      }
    } catch (err) {
      console.error(err);
      alert('Erro inesperado. Tente novamente.');
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
      
      {/* Floating Branco Stones and Casino Icons */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        {[
          { icon: '/blaze-white.png', top: '10%', left: '5%', scale: 1.2, duration: 25 },
          { icon: '/blaze-white.png', top: '40%', left: '85%', scale: 1.5, duration: 30 },
          { icon: '/blaze-white.png', top: '75%', left: '15%', scale: 0.9, duration: 20 },
          { icon: '/blaze-white.png', top: '25%', left: '75%', scale: 1.3, duration: 28 },
          { icon: '/blaze-white.png', top: '85%', left: '80%', scale: 1.1, duration: 22 },
          { icon: '/blaze-white.png', top: '55%', left: '10%', scale: 1.4, duration: 26 },
        ].map((stone, i) => (
          <motion.img 
            key={i}
            src={stone.icon} 
            alt="Branco"
            style={{ top: stone.top, left: stone.left, transform: `scale(${stone.scale})` }}
            className="absolute w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]"
            animate={{
              y: [0, -40, 0],
              x: [0, 20, 0],
              rotate: [0, 360],
            }}
            transition={{ duration: stone.duration, repeat: Infinity, repeatType: 'reverse', ease: "linear" }}
          />
        ))}
        {/* Floating Clocks / Time Elements */}
        {[
          { top: '25%', left: '80%', scale: 0.7, duration: 40 },
          { top: '60%', left: '10%', scale: 0.9, duration: 35 },
        ].map((clock, i) => (
           <motion.div 
             key={`clock-${i}`}
             style={{ top: clock.top, left: clock.left, transform: `scale(${clock.scale})` }}
             className="absolute w-20 h-20 rounded-full border-2 border-[#00c83a]/20 bg-[#00c83a]/[0.02] backdrop-blur-md shadow-[0_0_30px_rgba(0,200,58,0.1)] flex items-center justify-center"
             animate={{ rotate: [0, 360], y: [0, -40, 0] }}
             transition={{ duration: clock.duration, repeat: Infinity, ease: "linear" }}
           >
              <div className="w-1 h-8 bg-[#00c83a]/40 absolute bottom-1/2 left-1/2 origin-bottom rounded-full" style={{ transform: 'translateX(-50%)' }}></div>
              <div className="w-8 h-1 bg-[#00c83a]/40 absolute top-1/2 left-1/2 origin-left rounded-full" style={{ transform: 'translateY(-50%)' }}></div>
              <div className="absolute inset-[-4px] rounded-full border border-[#00c83a]/10 border-dashed animate-[spin_10s_linear_infinite]"></div>
           </motion.div>
        ))}
      </div>
      
      {/* Luzes de fundo globais */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#00c83a]/[0.03] blur-[150px] rounded-full"></div>
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-[#f12c4c]/[0.02] blur-[150px] rounded-full"></div>
        <div className="absolute top-[80%] left-[-10%] w-[800px] h-[800px] bg-[#eab308]/[0.02] blur-[150px] rounded-full"></div>
      </div>

      {/* HEADER FIXO */}
      <header className={`fixed top-0 w-full z-[100] transition-all duration-300 py-3 md:py-4 ${scrolled ? 'bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.8)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-3 group cursor-pointer shrink-0">
            <img src="/icon.svg" alt="Apex Machine" className="w-7 h-7 md:w-9 md:h-9 object-contain drop-shadow-[0_0_10px_rgba(241,44,76,0.5)] transition-transform group-hover:scale-110" />
            <h1 className="text-[16px] md:text-2xl font-black tracking-tighter flex gap-1 uppercase">
              <span className="text-[#f12c4c]">APEX</span>
              <span className="text-[#00c83a]">MACHINE</span>
            </h1>
          </div>
          <div className="flex items-center shrink-0">
            <Link href="/painel-master" className="px-3 md:px-6 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-[10px] md:text-xs font-bold tracking-widest text-white uppercase rounded-lg transition-all flex items-center gap-1.5 md:gap-2 whitespace-nowrap">
              <LayoutDashboard size={14} className="text-[#00c83a]" />
              <span className="hidden sm:inline">Acesso ao Terminal</span>
              <span className="sm:hidden">Terminal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20 z-10">
        <div className="text-center max-w-5xl mx-auto flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00c83a]/10 border border-[#00c83a]/30 text-[10px] font-black uppercase tracking-widest text-[#00c83a] mb-8 shadow-[0_0_20px_rgba(0,200,58,0.15)]"
          >
            <Eye size={14} />
            <span>Mais contexto na tela. Mais critério na decisão.</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.1] mb-6 text-white uppercase"
          >
            Chega de operar o Double <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f12c4c] to-[#eab308] drop-shadow-[0_0_30px_rgba(241,44,76,0.3)]">
              no achismo.
            </span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl mx-auto mb-8"
          >
            A Apex Machine é a central de análise para quem quer ler padrões, visualizar contexto e tomar decisões com mais critério — <strong className="text-white font-bold">sem depender de sala de sinais, guru ou impulso.</strong>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center gap-4"
          >
            <button 
              onClick={scrollToPlanos}
              className="px-8 py-4 bg-[#00c83a] hover:bg-[#00a830] text-black font-black uppercase tracking-widest text-sm rounded-xl shadow-[0_0_30px_rgba(0,200,58,0.3)] hover:shadow-[0_0_50px_rgba(0,200,58,0.5)] transition-all hover:scale-105 flex items-center gap-2"
            >
              Quero operar com método
              <ArrowRight size={18} />
            </button>
            <p className="text-xs text-gray-500 font-medium max-w-md mx-auto">
              Não é robô. Não promete lucro fácil. É uma ferramenta de análise para quem quer operar com seriedade.
            </p>
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
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute -top-6 -right-6 md:-right-12 z-20 bg-[#0a0a0f] text-white font-black text-xs uppercase tracking-widest py-3 px-6 rounded-2xl rounded-bl-none shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/20 flex flex-col gap-1"
          >
            <span className="text-[#00c83a]">Leitura Própria:</span>
            Contexto em Tempo Real
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute top-[40%] -left-6 md:-left-12 z-30 bg-[#12141c] text-white font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl rounded-tr-none shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col gap-1"
          >
            <span className="text-[#f12c4c]">Disciplina:</span>
            O Fim do Impulso
          </motion.div>
          
          <div className="relative bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden aspect-video flex flex-col">
            <div className="h-12 bg-[#050507] border-b border-white/5 flex items-center px-6 gap-6">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              </div>
              <div className="flex gap-4 text-sm font-black text-white tracking-widest uppercase">
                Terminal de Análise
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00c83a] animate-pulse"></div>
                <span className="text-[10px] uppercase font-bold text-[#00c83a] tracking-widest">Sincronizado</span>
              </div>
            </div>
            
            <div className="flex-1 bg-[#0a0a0f] flex flex-col">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr] text-[10px] font-black text-gray-400 uppercase tracking-widest py-4 px-6 border-b border-white/5 bg-[#12141c]/50">
                <div className="text-center">Padrão Mapeado</div>
                <div className="text-center">Tx. Eficiência</div>
                <div className="text-center">WIN</div>
                <div className="text-center">LOSS</div>
                <div className="text-center">PNL Histórico</div>
                <div className="text-center">Atraso</div>
                <div className="text-center">Status</div>
              </div>
              
              <div className="flex flex-col py-2">
                {[
                  { pattern: [null, {c:'red', v:2}, null], tx: 'Alta', w: 142, l: 30, pnl: '+412' },
                  { pattern: [null, {c:'red', v:14}, {c:'black', v:14}], tx: 'Média', w: 89, l: 40, pnl: '+189' },
                  { pattern: [{c:'black', v:13}, {c:'red', v:14}, null], tx: 'Baixa', w: 12, l: 60, pnl: '-240' },
                  { pattern: [{c:'black', v:8}, null, {c:'red', v:null}], tx: 'Alta', w: 210, l: 20, pnl: '+890' },
                  { pattern: [null, {c:'black', v:9}, null, {c:'red', v:null}], tx: 'Extrema', w: 345, l: 15, pnl: '+1.2K' },
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
                    <div className={`text-center ${row.tx === 'Extrema' || row.tx === 'Alta' ? 'text-[#00c83a]' : row.tx === 'Média' ? 'text-[#eab308]' : 'text-[#f12c4c]'}`}>{row.tx}</div>
                    <div className="text-white text-center">{row.w}</div>
                    <div className="text-gray-500 text-center">{row.l}</div>
                    <div className={`text-center font-black ${row.pnl.startsWith('+') ? 'text-[#00c83a]' : 'text-[#f12c4c]'}`}>{row.pnl}</div>
                    <div className="text-gray-400 text-center">-</div>
                    <div className="text-gray-400 text-center">-</div>
                  </div>
                ))}
              </div>
              <div className="mt-auto bg-gradient-to-t from-[#050507] to-transparent h-16 w-full absolute bottom-0 pointer-events-none"></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SEÇÃO DE DOR */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5 bg-[#0a0a0f]">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <Target size={48} className="text-[#f12c4c] mb-6 opacity-80 drop-shadow-[0_0_15px_rgba(241,44,76,0.5)]" />
          <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-8 leading-tight">
            Se você já operou no impulso, <br/> você sabe <span className="text-[#f12c4c]">o preço disso.</span>
          </h3>
          <p className="text-gray-400 text-lg leading-relaxed mb-6">
            Entrar atrasado em um sinal VIP, buscar recuperação logo depois de um red e confundir uma sequência curta com uma oportunidade de ouro são os erros mais comuns de quem opera sem contexto.
          </p>
          <p className="text-gray-400 text-lg leading-relaxed mb-10 font-medium text-white">
            O problema não é só perder. O problema é perder sem entender o cenário, sem filtro e dependendo única e exclusivamente da leitura de outra pessoa.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
            <div className="bg-[#12141c] border border-white/5 rounded-xl p-6">
              <h4 className="text-[#f12c4c] font-black uppercase tracking-widest text-sm mb-4 border-b border-white/5 pb-2">Quem vive de copiar sinal:</h4>
              <ul className="space-y-3">
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Quase sempre chega atrasado na entrada.</li>
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Não entende o raciocínio por trás do clique.</li>
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Vira refém eterno de grupos e mensalidades.</li>
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Entrega a banca para a emoção quando o Red vem.</li>
              </ul>
            </div>
            <div className="bg-[#12141c] border border-[#00c83a]/20 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00c83a]/5 to-transparent pointer-events-none"></div>
              <h4 className="text-[#00c83a] font-black uppercase tracking-widest text-sm mb-4 border-b border-white/5 pb-2 relative z-10">Quem opera com a Apex:</h4>
              <ul className="space-y-3 relative z-10">
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Enxerga o padrão se formando antes de acontecer.</li>
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Sabe exatamente a taxa de assertividade daquela entrada.</li>
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Tem autonomia total para parar ou continuar.</li>
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Trata o mercado com disciplina de investidor.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DA SOLUÇÃO (FEATURES) */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-6">
              A Apex Machine foi criada para transformar dado solto em <span className="text-[#00c83a]">leitura clara.</span>
            </h3>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Em vez de olhar para o Double no "olho", você passa a operar com uma estrutura visual que destaca padrões, contexto e zonas de atenção em tempo real. Você não fica preso a uma única visão. Você opera com mais contexto na mesma tela.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-2 shadow-2xl relative overflow-hidden group">
              <img src="/pnl-chart.png" alt="Gráfico PNL Blaze" className="w-full h-auto rounded-xl shadow-lg relative z-10" />
              <div className="absolute bottom-6 left-6 z-20 bg-black/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-lg flex items-center gap-2">
                <BarChart2 size={16} className="text-[#00c83a]" />
                <span className="text-white text-xs font-black uppercase tracking-widest">Gráficos Profissionais</span>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <h4 className="text-3xl font-black uppercase text-white tracking-tight">Gráficos com Médias e Volatilidade</h4>
              <p className="text-gray-400 text-lg">
                Identifique ciclos de arrecadação e distribuição matematicamente. Aplique Médias Móveis (SMA/EMA) e Bandas de Bollinger diretamente no gráfico de PNL para enxergar o contexto do mercado muito além do curto prazo.
              </p>
              <ul className="flex flex-col gap-3 mt-2">
                <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Fuja de horários de arrecadação máxima.</li>
                <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Identifique topos e fundos estatísticos.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="flex flex-col gap-6 order-2 lg:order-1">
              <h4 className="text-3xl font-black uppercase text-white tracking-tight">Painel Master & Radares de Padrões</h4>
              <p className="text-gray-400 text-lg">
                Nossos radares varrem as últimas milhares de rodadas para identificar as famosas zonas de atenção (Dentado, Banguelo, Sequências e Máximas). Pare de adivinhar quando o branco vai quebrar o padrão.
              </p>
              <ul className="flex flex-col gap-3 mt-2">
                <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Leitura de sequências instantânea.</li>
                <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Máximas absolutas das últimas 24h ou 7 Dias.</li>
              </ul>
            </div>
            <div className="bg-[#12141c] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex items-center justify-center group order-1 lg:order-2 aspect-video">
              <img src="/minutos-ia.png" alt="Radares" className="absolute w-[80%] rounded-lg shadow-2xl z-10 border border-white/10 transform rotate-[-5deg] hover:rotate-0 transition-transform duration-500" />
              <div className="absolute top-6 right-6 z-20 bg-black/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-lg flex items-center gap-2">
                <Crosshair size={16} className="text-[#f12c4c]" />
                <span className="text-white text-xs font-black uppercase tracking-widest">Radares ao Vivo</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO DOS PERFIS (DIVISÃO MENTAL) */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5 bg-[#00c83a]/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <BrainCircuit size={48} className="text-[#00c83a] mb-6 opacity-80 drop-shadow-[0_0_15px_rgba(0,200,58,0.5)] mx-auto" />
            <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Para quem a <span className="text-[#00c83a]">Apex Machine</span> foi feita?
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0a0a0f] border border-white/10 hover:border-white/20 transition-all rounded-3xl p-10 flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-[#f12c4c]/5 to-transparent pointer-events-none"></div>
              <h4 className="text-2xl font-black uppercase text-white mb-6 relative z-10">
                1. Para quem cansou de <span className="text-[#f12c4c]">seguir sinais</span>
              </h4>
              <p className="text-gray-400 text-lg mb-8 relative z-10">
                Se você já percebeu que grupo grátis, sala VIP atrasada e guru não constroem consistência, a Apex Machine te ajuda a **ganhar autonomia**.
              </p>
              <ul className="space-y-4 mb-10 relative z-10">
                <li className="flex items-start gap-3 text-sm text-gray-300 font-medium"><ShieldCheck size={20} className="text-[#f12c4c] shrink-0" /> Enxergar melhor os padrões do mercado.</li>
                <li className="flex items-start gap-3 text-sm text-gray-300 font-medium"><ShieldCheck size={20} className="text-[#f12c4c] shrink-0" /> Identificar as zonas mais lucrativas sozinho.</li>
                <li className="flex items-start gap-3 text-sm text-gray-300 font-medium"><ShieldCheck size={20} className="text-[#f12c4c] shrink-0" /> Parar de terceirizar a responsabilidade da sua banca.</li>
              </ul>
              <div className="mt-auto px-6 py-4 bg-[#f12c4c]/10 border border-[#f12c4c]/20 rounded-xl relative z-10">
                <p className="text-[#f12c4c] font-black text-sm uppercase tracking-widest text-center">Você deixa de seguir a entrada dos outros e começa a entender a sua.</p>
              </div>
            </div>

            <div className="bg-[#0a0a0f] border border-white/10 hover:border-white/20 transition-all rounded-3xl p-10 flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-[#00c83a]/5 to-transparent pointer-events-none"></div>
              <h4 className="text-2xl font-black uppercase text-white mb-6 relative z-10">
                2. Para quem prefere operar com <span className="text-[#00c83a]">método</span>
              </h4>
              <p className="text-gray-400 text-lg mb-8 relative z-10">
                Se você já trata sua banca com disciplina, sabe que o maior erro é entrar sem contexto. A ferramenta te poupa o trabalho braçal de catalogação.
              </p>
              <ul className="space-y-4 mb-10 relative z-10">
                <li className="flex items-start gap-3 text-sm text-gray-300 font-medium"><ShieldCheck size={20} className="text-[#00c83a] shrink-0" /> Filtrar o ruído visual do cassino.</li>
                <li className="flex items-start gap-3 text-sm text-gray-300 font-medium"><ShieldCheck size={20} className="text-[#00c83a] shrink-0" /> Visualizar tendências longas em segundos.</li>
                <li className="flex items-start gap-3 text-sm text-gray-300 font-medium"><ShieldCheck size={20} className="text-[#00c83a] shrink-0" /> Reduzir drasticamente as decisões baseadas em feeling.</li>
              </ul>
              <div className="mt-auto px-6 py-4 bg-[#00c83a]/10 border border-[#00c83a]/20 rounded-xl relative z-10">
                <p className="text-[#00c83a] font-black text-sm uppercase tracking-widest text-center">Consistência não nasce do impulso. Nasce da repetição de boas decisões.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* POSICIONAMENTO E OBJEÇÕES */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl md:text-4xl font-black uppercase text-white tracking-tighter mb-8">
            Apex Machine não vende milagre. <br/><span className="text-gray-500">Entrega estrutura.</span>
          </h3>
          <p className="text-gray-400 text-lg mb-12">
            Se alguém te promete lucro garantido nesse mercado, desconfie. Nossa proposta é organizar a leitura, acelerar a análise, reduzir o achismo e apoiar decisões disciplinadas. Porque a diferença entre operar no impulso e operar com método começa **na tela que você usa antes da entrada**.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
            <div className="bg-[#12141c] border border-white/5 p-6 rounded-xl">
              <h5 className="text-white font-black uppercase text-sm mb-2">É uma sala de sinais?</h5>
              <p className="text-gray-400 text-sm">Não. A Apex Machine não foi feita para te deixar dependente de call. Ela foi criada para te dar leitura e total autonomia.</p>
            </div>
            <div className="bg-[#12141c] border border-white/5 p-6 rounded-xl">
              <h5 className="text-white font-black uppercase text-sm mb-2">É um robô de aposta?</h5>
              <p className="text-gray-400 text-sm">Não. A decisão final é sempre sua. A ferramenta simplesmente organiza os dados matemáticos e exibe os padrões invisíveis a olho nu.</p>
            </div>
          </div>
        </div>
      </section>

      {/* AUTOMATION PARTNERSHIP */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#12141c] to-[#0a0a0f] border border-[#f12c4c]/30 rounded-3xl p-10 md:p-16 text-center shadow-[0_20px_50px_rgba(241,44,76,0.1)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f12c4c]/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#eab308]/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          <img src="/blaze-bot.png" alt="Blaze Machine" className="w-24 h-24 mx-auto mb-6 object-contain drop-shadow-[0_0_20px_rgba(241,44,76,0.3)]" />
          <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-6">
            Quer automatizar suas operações?
          </h3>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
            Você encontrou a estratégia de ouro no Apex e não quer perder noites de sono esperando ela bater? Nós somos a melhor ferramenta de análise. Para automatizar suas entradas com máxima segurança, recomendamos a nossa parceira oficial.
          </p>
          <a 
            href="https://app.blazemachine.com.br/loja?code=automoney" 
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-10 py-5 bg-[#f12c4c] hover:bg-red-500 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 shadow-[0_0_30px_rgba(241,44,76,0.3)]"
          >
            Conheça a Blaze Machine
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-32 px-6 relative z-10 border-t border-[#00c83a]/20 bg-[#00c83a]/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Junte-se à <span className="text-[#00c83a]">Elite Operacional</span>
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Selecione o passe de acesso ao terminal. Liberação imediata após a confirmação. Troque o impulso por contexto agora mesmo.
            </p>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center max-w-7xl mx-auto">
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
                 <h4 className={`text-xl font-black mb-1.5 tracking-wider uppercase ${plan.recommended ? 'text-[#00ff41]' : 'text-white'}`}>{plan.name}</h4>
                 <p className="text-gray-500 text-[13px] leading-relaxed">{plan.description}</p>
               </div>
               
               <div className="mb-8 flex items-baseline gap-1">
                 <span className="text-gray-400 font-bold text-sm">R$</span>
                 <span className={`text-5xl font-black tracking-tighter text-white`}>{plan.price}</span>
                 <span className="text-gray-500 font-medium text-xs ml-1">/ {plan.days === 1 ? 'dia' : `${plan.days} dias`}</span>
               </div>
               
               <ul className="flex-grow space-y-4 mb-10">
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Acesso ao Painel Master</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Radares de Padrões VIP</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Gráficos de Volatilidade</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Visão Histórica (7 Dias)</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Simulador PNL Avançado</span>
                 </li>
               </ul>
               
               <button 
                 onClick={() => handleCheckout(plan.days)}
                 disabled={loading !== null}
                 className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 ${
                   plan.recommended 
                    ? 'bg-[#00ff41] hover:bg-[#00dd38] text-black shadow-[0_0_20px_rgba(0,255,65,0.3)] hover:shadow-[0_0_30px_rgba(0,255,65,0.5)]' 
                    : 'bg-[#12141c] hover:bg-[#1a1d24] border border-white/5 hover:border-white/10 text-white'
                 }`}
               >
                 {loading === String(plan.days) ? 'Processando...' : 'Garantir Acesso'}
                 {loading !== String(plan.days) && <Lock size={14} className={plan.recommended ? 'text-black' : 'text-gray-400'} />}
               </button>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* CTA FINAL DE CONTATO */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <HelpCircle size={48} className="text-[#00c83a] mb-6 opacity-50" />
          <h3 className="text-4xl md:text-5xl font-black uppercase text-white tracking-tighter mb-6">
            Ainda tem <span className="text-[#00c83a]">dúvidas?</span>
          </h3>
          <p className="text-gray-400 text-lg mb-10 max-w-xl">
            Se você quer ver o terminal funcionando na prática antes de assinar, ou precisa falar com a nossa equipe, entre em contato direto pelo suporte.
          </p>
          <a 
            href="https://wa.me/5547991523220?text=Ol%C3%A1%2C+vim+pelo+Apex+Machine+e+tenho+uma+d%C3%BAvida."
            target="_blank"
            className="px-10 py-5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 shadow-[0_0_30px_rgba(37,211,102,0.3)] flex items-center gap-3"
          >
            Falar com o Suporte
            <MessageCircle size={18} />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-white/5 text-center relative z-10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 opacity-50 grayscale hover:grayscale-0 transition-all cursor-pointer">
            <img src="/icon.svg" alt="Apex Machine" className="w-8 h-8 object-contain" />
            <span className="text-xl font-black tracking-tighter text-white flex gap-1 uppercase">
              APEX <span className="font-light">MACHINE</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Apex Machine é o terminal analítico definitivo focado em estatística de alta precisão e probabilidade para validação de leitura e ciclos matemáticos. Nós fornecemos ferramentas de visualização de dados e backtesting. Não processamos apostas nem garantimos ganhos financeiros, pois operações envolvem riscos de mercado. Seja responsável.
          </p>
          <div className="flex items-center gap-4 mt-2">
            <a href="mailto:sup_apexmachine@gmail.com" title="E-mail" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
               <Mail size={16} />
            </a>
            <a href="https://wa.me/5547991523220?text=Ol%C3%A1%2C+vim+pelo+Apex+Machine+e+tenho+uma+d%C3%BAvida." target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-[#25D366] hover:bg-white/10 transition-colors">
               <MessageCircle size={16} />
            </a>
            <a href="https://t.me/sup_apexmachine" target="_blank" rel="noopener noreferrer" title="Telegram" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-[#2AABEE] hover:bg-white/10 transition-colors">
               <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>
          </div>
          <div className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mt-4">
            © {new Date().getFullYear()} APEX MACHINE. TODOS OS DIREITOS RESERVADOS.
          </div>
        </div>
      </footer>
    </main>
  );
}
