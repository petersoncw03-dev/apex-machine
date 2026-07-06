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
  HelpCircle
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
      description: 'Uma semana inteira de sinais VIP.',
      recommended: false,
    },
    {
      id: 'quinzenal',
      name: 'Acesso Quinzenal',
      days: 15,
      price: '35',
      description: 'Tempo ideal para criar consistência.',
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
      // Importa o cliente Supabase dinamicamente para pegar a sessão
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        // Usuário não está logado — redireciona para login
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
          { icon: '/blaze-white.png', top: '15%', left: '50%', scale: 0.8, duration: 32 },
          { icon: '/blaze-white.png', top: '90%', left: '40%', scale: 1.2, duration: 24 },
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
        {/* Floating Magical Elements (Alice in Wonderland style) */}
        {[
          { label: 'A', suit: '♠', top: '15%', left: '15%', scale: 1.1, duration: 25 },
          { label: 'A', suit: '♥', top: '70%', left: '85%', scale: 0.9, duration: 22 },
          { label: 'A', suit: '♦', top: '85%', left: '25%', scale: 1.2, duration: 28 },
          { label: 'A', suit: '♣', top: '35%', left: '60%', scale: 0.85, duration: 33 },
        ].map((card, i) => (
           <motion.div 
             key={`magic-card-${i}`}
             style={{ top: card.top, left: card.left, transform: `scale(${card.scale})` }}
             className="absolute flex flex-col items-center justify-center w-12 h-16 md:w-16 md:h-24 rounded-lg bg-white/[0.02] border border-white/10 backdrop-blur-[2px] shadow-[0_0_20px_rgba(255,255,255,0.05)] text-white/40"
             animate={{ y: [0, -30, 0], x: [0, -15, 0], rotate: [0, 10, -10, 0] }}
             transition={{ duration: card.duration, repeat: Infinity, repeatType: 'reverse', ease: "easeInOut" }}
           >
             <span className="text-sm md:text-lg font-black leading-none">{card.label}</span>
             <span className="text-2xl md:text-4xl leading-none mt-1">{card.suit}</span>
           </motion.div>
        ))}

        {/* Floating Clocks / Time Elements */}
        {[
          { top: '25%', left: '80%', scale: 0.7, duration: 40 },
          { top: '60%', left: '10%', scale: 0.9, duration: 35 },
          { top: '10%', left: '50%', scale: 0.5, duration: 45 },
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
              {/* Outer glowing ring */}
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
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#eab308]/10 border border-[#eab308]/30 text-[10px] font-black uppercase tracking-widest text-[#eab308] mb-8 shadow-[0_0_20px_rgba(234,179,8,0.15)]"
          >
            <Activity size={14} />
            <span>O Terminal Definitivo para Validar Sinais</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter leading-[1.1] mb-6 text-white uppercase"
          >
            Tenha a melhor visão de jogo <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c83a] to-emerald-600 drop-shadow-[0_0_30px_rgba(0,200,58,0.3)]">
              antes de apostar seu dinheiro.
            </span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl mx-auto mb-12"
          >
            O Terminal Analítico que funciona como o "Raio-X" da roleta. Saiba se os sinais do seu robô fazem sentido no momento, descubra tendências de Branco e teste padrões sem arriscar um centavo.
          </motion.p>
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
            <span className="text-[#00c83a]">Radar Ao Vivo:</span>
            Validação de Sinais
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute top-[40%] -left-6 md:-left-12 z-30 bg-[#12141c] text-white font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl rounded-tr-none shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col gap-1"
          >
            <span className="text-[#f12c4c]">Taxa de Acerto (TX):</span>
            Rankeamento Instantâneo
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8 }}
            className="absolute -bottom-6 right-1/4 z-30 bg-[#0a0a0f] text-white font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl rounded-tl-none shadow-[0_10px_30px_rgba(0,200,58,0.2)] border border-[#00c83a]/30 flex flex-col gap-1"
          >
            <span className="text-[#eab308]">Filtro Automático:</span>
            Ignora Padrões Quebrados
          </motion.div>
          
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

      {/* PNL GLOBAL SECTION */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-6">
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white leading-tight">
              Não existe estratégia ruim. Existe <span className="text-[#f12c4c]">momento errado</span>.
            </h3>
            <p className="text-gray-400 text-lg leading-relaxed">
              A Blaze não funciona por sorte, ela opera por ciclos matemáticos de Arrecadação e Distribuição. O Apex intercepta esses dados e exibe o gráfico de Ganhos e Perdas (PNL) real da roleta.
            </p>
            <p className="text-gray-400 text-lg leading-relaxed">
              Se o gráfico está despencando, até as piores estratégias viram ouro se operadas ao contrário. Se está subindo, o sistema te mostra quais padrões estão no topo de acertos. Você surfa a onda no momento exato.
            </p>
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-lg bg-[#00c83a]/10 border border-[#00c83a]/20 text-[#00c83a] font-bold text-sm uppercase tracking-widest w-fit mt-4">
              <ShieldCheck size={20} />
              A Maré Exata da Mesa
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <BarChart2 className="text-[#00c83a]" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Gráfico Profissional</h4>
              <p className="text-xs text-gray-500">Adicione médias móveis (SMA, EMA) e indicadores no gráfico de PNL, operando como um verdadeiro trader profissional, mas no cassino.</p>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <Target className="text-[#eab308]" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Streaks Máximos</h4>
              <p className="text-xs text-gray-500">O sistema filtra as estratégias que estão na máxima (acertando tudo) para você copiar no instante que a mesa estiver pagando.</p>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <Radio className="text-purple-500" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Avisos Sonoros</h4>
              <p className="text-xs text-gray-500">Foque no seu trabalho. O sistema apita quando o Branco bate, ou quando qualquer estratégia customizada se forma na mesa.</p>
            </div>
            <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-xl flex flex-col gap-3 hover:border-white/20 transition-all">
              <Cpu className="text-[#f12c4c]" size={32} />
              <h4 className="font-black text-white uppercase tracking-widest text-sm">Extração de Dados</h4>
              <p className="text-xs text-gray-500">Baixe todo o histórico recente das rodadas (todas as cores ou só branco) para fazer análises avançadas no seu próprio Excel.</p>
            </div>
          </div>
          
          <div className="md:col-span-2 mt-8 bg-[#0a0a0f] border border-white/10 rounded-2xl p-2 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00c83a]/10 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <img src="/pnl-chart.png" alt="Gráfico PNL Blaze" className="w-full h-auto rounded-xl shadow-lg relative z-10" />
            
            {/* Medias Móveis Baloon */}
            <div className="absolute top-[30%] left-[20%] z-20 bg-[#12141c] text-white font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl rounded-bl-none shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col gap-1 hidden md:flex hover:scale-105 transition-transform cursor-pointer">
              <span className="text-[#00c83a]">Indicadores Premium:</span>
              SMA, EMA & Bandas de Bollinger
            </div>

            {/* Ciclos de Mercado Baloon */}
            <div className="absolute bottom-[40%] right-[15%] z-20 bg-[#0a0a0f] text-white font-black text-[10px] uppercase tracking-widest py-3 px-6 rounded-2xl rounded-tr-none shadow-[0_10px_30px_rgba(241,44,76,0.3)] border border-[#f12c4c]/30 flex flex-col gap-1 hidden md:flex hover:scale-105 transition-transform cursor-pointer">
              <span className="text-[#f12c4c]">Leitura de Ciclos:</span>
              Identifique Zonas de Arrecadação
            </div>

            <div className="absolute bottom-6 left-6 z-20 bg-black/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-lg flex items-center gap-2 shadow-[0_0_20px_rgba(0,200,58,0.2)]">
              <div className="w-2 h-2 rounded-full bg-[#00c83a] animate-pulse"></div>
              <span className="text-[#00c83a] text-xs font-black uppercase tracking-widest">Gráfico Oficial BLAZE</span>
            </div>
          </div>
        </div>
      </section>

      {/* DEEP DIVE FEATURES */}
      <section id="funcionalidades" className="py-32 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Ferramentas de <span className="text-[#00c83a]">Auditoria Máxima</span>
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Destrua a necessidade do papel e caneta. Nossos módulos vasculham as estatísticas passadas e te entregam a confluência mastigada.
            </p>
          </div>

          <div className="flex flex-col gap-24">
            
            {/* Mod 1 */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 flex flex-col gap-4 order-2 md:order-1">
                <div className="px-3 py-1 bg-[#8b008b]/10 border border-[#8b008b]/30 text-[#d8b4e2] text-[10px] font-black uppercase tracking-widest rounded-md w-fit">Minutos da IA & Scanner 90 Dias</div>
                <h4 className="text-3xl font-black uppercase text-white tracking-tight">O Fim do Caderninho</h4>
                <p className="text-gray-400">Nossa inteligência cruza diversas estratégias simultaneamente e te entrega os "Minutos da IA", uma matriz exata com os melhores minutos para entrar. Além disso, nosso Scanner de 3 Meses encontra "horários cheios" que não pagaram Branco há mais de 90 dias, jogando a probabilidade extrema ao seu favor.</p>
                <ul className="flex flex-col gap-3 mt-4">
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Encontre atrasos históricos de Branco.</li>
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Confluência de múltiplos padrões.</li>
                </ul>
              </div>
              <div className="flex-1 w-full aspect-video bg-[#12141c] border border-white/10 rounded-2xl p-6 shadow-2xl relative order-1 md:order-2 overflow-hidden flex items-center justify-center group perspective-1000">
                 <div className="absolute inset-0 bg-gradient-to-tr from-[#8b008b]/20 to-transparent transition-opacity group-hover:opacity-40"></div>
                 <img src="/minutos-ia.png" alt="Minutos IA" className="absolute w-[75%] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] transform rotate-[-8deg] -translate-x-8 -translate-y-8 group-hover:rotate-0 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700 ease-out z-10 border border-white/10" />
                 <img src="/painel-minutos.png" alt="Painel Minutos" className="absolute w-[75%] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] transform rotate-[8deg] translate-x-12 translate-y-12 group-hover:rotate-0 group-hover:translate-x-6 group-hover:translate-y-8 transition-all duration-700 ease-out z-20 border border-white/10" />
              </div>
            </div>

            {/* Mod 2 */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1 w-full aspect-video bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden flex items-center justify-center group">
                 <div className="absolute inset-0 bg-gradient-to-tr from-[#00c83a]/20 to-transparent z-10"></div>
                 <img src="/backtester.png" alt="Backtester" className="absolute w-full h-full object-cover opacity-20 group-hover:opacity-80 transition-all duration-700 ease-out" />
                 <div className="text-center relative z-20 transition-transform duration-700 group-hover:scale-95 group-hover:opacity-0 pointer-events-none">
                    <Activity size={64} className="text-[#00c83a] opacity-80 mb-4 mx-auto drop-shadow-[0_0_15px_rgba(0,200,58,0.5)]" />
                    <span className="font-mono text-white font-bold uppercase tracking-widest text-xs drop-shadow-md bg-black/80 border border-white/10 px-4 py-2 rounded-lg">Simulador Backtester</span>
                 </div>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                <div className="px-3 py-1 bg-[#00c83a]/10 border border-[#00c83a]/30 text-[#4ade80] text-[10px] font-black uppercase tracking-widest rounded-md w-fit">Time-Machine Backtester</div>
                <h4 className="text-3xl font-black uppercase text-white tracking-tight">O Fim do Achismo</h4>
                <p className="text-gray-400">Teve uma ideia de padrão genial? Não teste no achismo com seu saldo real. Jogue no Simulador do Apex, e em segundos ele cruza as últimas milhares de rodadas para te dizer matematicamente se essa ideia dá lucro ou prejuízo no longo prazo.</p>
                <ul className="flex flex-col gap-3 mt-4">
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Validação antes de arriscar 1 centavo.</li>
                  <li className="flex items-center gap-3 text-sm font-bold text-gray-300"><Target size={16} className="text-[#00c83a]" /> Gráficos e Relatórios de assertividade.</li>
                </ul>
              </div>
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
            Você encontrou a estratégia de ouro no Apex e não quer perder noites de sono esperando ela bater? Nós somos a melhor ferramenta de análise. Para automatizar suas entradas com máxima segurança e velocidade, nós recomendamos a nossa parceira oficial.
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

      {/* ESTATÍSTICAS / SOCIAL PROOF */}
      <section className="py-16 px-6 border-y border-[#00c83a]/20 bg-[#00c83a]/5 relative z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-around gap-8 text-center">
          <div className="flex flex-col items-center gap-2">
             <span className="text-5xl font-black text-white">+2.880</span>
             <span className="text-[10px] uppercase font-black tracking-widest text-[#00c83a]">Rodadas Analisadas / Dia</span>
          </div>
          <div className="flex flex-col items-center gap-2">
             <span className="text-5xl font-black text-white">100%</span>
             <span className="text-[10px] uppercase font-black tracking-widest text-[#00c83a]">Pedras em Tempo Real</span>
          </div>
          <div className="flex flex-col items-center gap-2">
             <span className="text-5xl font-black text-white">+43.000</span>
             <span className="text-[10px] uppercase font-black tracking-widest text-[#00c83a]">Padrões Validados</span>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl md:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Junte-se à <span className="text-[#eab308]">Elite Operacional</span>
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Selecione o passe de acesso ao terminal que mais se adequa ao seu nível. Liberação imediata após a confirmação. Comece a auditar seus sinais agora.
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
                 <span className={`text-5xl font-black tracking-tighter ${plan.recommended ? 'text-white' : 'text-white'}`}>{plan.price}</span>
                 <span className="text-gray-500 font-medium text-xs ml-1">/ {plan.days === 1 ? 'dia' : `${plan.days} dias`}</span>
               </div>
               
               <ul className="flex-grow space-y-4 mb-10">
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Acesso total ao Gráfico PNL</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Confluência de IA & Minutos</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Simulador Backtest 43k Rodadas</span>
                 </li>
                 <li className="flex items-start gap-3 text-sm text-gray-300 font-medium">
                   <ShieldCheck size={18} className="text-[#00ff41] shrink-0 mt-0.5" /> 
                   <span className="leading-tight">Alertas Sonoros e Visuais</span>
                 </li>
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
                 {loading === String(plan.days) ? 'Processando...' : 'Garantir Acesso'}
               </button>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* CTA FINAL */}
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
            Apex Machine é o terminal analítico definitivo focado em estatística de alta precisão e probabilidade para validação de sinais e leitura de ciclos matemáticos. Nós fornecemos ferramentas de visualização de dados e backtesting. Não processamos apostas nem garantimos ganhos financeiros, pois operações financeiras envolvem riscos de mercado. Seja responsável.
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
