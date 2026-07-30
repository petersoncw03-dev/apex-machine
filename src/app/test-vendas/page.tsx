'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  Activity, 
  ShieldCheck, 
  BarChart2, 
  Lock,
  ArrowRight,
  LayoutDashboard,
  Mail,
  MessageCircle,
  HelpCircle,
  Eye,
  Crosshair,
  BrainCircuit,
  Database,
  Globe,
  AlertTriangle,
  Send,
  CheckCircle2,
  Cpu,
  Flame,
  Clock,
  Minus,
  Home,
  Camera,
  Plus,
  Trash,
  TrendingUp,
  Zap
} from 'lucide-react';

const WarningDisclaimer = () => (
  <div className="w-full mt-12 mb-4 px-4 py-3 border border-white/10 bg-white/[0.03] rounded-lg flex flex-col sm:flex-row items-center justify-center gap-3 transition-colors hover:bg-white/[0.05]">
    <AlertTriangle size={16} className="text-gray-400 shrink-0" />
    <span className="text-[10px] sm:text-xs font-bold text-gray-300 uppercase tracking-widest text-center">
      Ministério da Fazenda Adverte: Apostar pode causar dependência. 18+
    </span>
  </div>
);

export default function TestVendasPage() {
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // States
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<{ icon: string; color: string; msg: string; }[]>([]);
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);

  // Generate a fixed chart data once to prevent random shaking on re-renders
  const staticChartData = useRef(
    Array.from({ length: 280 }).reduce<{ data: any[]; state: any }>((acc, _, i) => {
      let { x, y, trend, trendLen, isDrop } = acc.state;
      if (trendLen <= 0) {
        if (isDrop) {
          trend = 'climb';
          // Use pseudo-random so it looks organic but static
          trendLen = Math.abs(Math.sin(i * 12.3)) * 20 + 15;
          isDrop = false;
        } else {
          trend = 'drop';
          trendLen = Math.abs(Math.cos(i * 4.2)) * 5 + (x > 400 && x < 550 ? 25 : 3);
          isDrop = true;
        }
      }
      if (trend === 'climb') {
         y -= 2; x += 3.5; trendLen--;
         acc.data.push({ x, y, type: 'climb' });
      } else {
         y += 4; trendLen--;
         acc.data.push({ x, y, type: 'drop' });
      }
      acc.state = { x, y, trend, trendLen, isDrop };
      return acc;
    }, { data: [], state: { x: -20, y: 250, trend: 'climb', trendLen: 30, isDrop: false } }).data
  ).current;
  
  // State for the Visão Geral Panel
  const [stoneIndex, setStoneIndex] = useState(0);
  
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Rotate hero images (cada 5s)
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Rotate Stone Data every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setStoneIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const stonesData = [
    { 
      stone: { color: 'black', number: '14' },
      posData: [
        { color: 'red', name: 'VERMELHO', sa: 2, sm: 8 },
        { color: 'black', name: 'PRETO', sa: 0, sm: 7 },
        { color: 'white', name: 'BRANCO', sa: 15, sm: 62 },
      ],
      global: {
        total: 2000, redPct: 47.1, blackPct: 45.8, whitePct: 7.1,
        redSA: 2, redSM: 10, blackSA: 0, blackSM: 12, whiteSA: 1, whiteSM: 54
      }
    },
    { 
      stone: { color: 'red', number: '5' },
      posData: [
        { color: 'red', name: 'VERMELHO', sa: 0, sm: 6 },
        { color: 'black', name: 'PRETO', sa: 1, sm: 9 },
        { color: 'white', name: 'BRANCO', sa: 32, sm: 81 },
      ],
      global: {
        total: 2000, redPct: 47.2, blackPct: 45.7, whitePct: 7.1,
        redSA: 0, redSM: 10, blackSA: 1, blackSM: 12, whiteSA: 2, whiteSM: 54
      }
    },
    { 
      stone: { color: 'white', number: 'flame' },
      posData: [
        { color: 'red', name: 'VERMELHO', sa: 1, sm: 5 },
        { color: 'black', name: 'PRETO', sa: 0, sm: 4 },
        { color: 'white', name: 'BRANCO', sa: 0, sm: 22 },
      ],
      global: {
        total: 2000, redPct: 47.1, blackPct: 45.6, whitePct: 7.3,
        redSA: 1, redSM: 10, blackSA: 2, blackSM: 12, whiteSA: 0, whiteSM: 54
      }
    }
  ];

  const currentStoneData = stonesData[stoneIndex];

  // Helper Row for Delay Table
  const GlobalDelayRow = ({ color, name, sa, sm }: { color: string, name: string, sa: number, sm: number }) => (
    <div className="flex items-center justify-between bg-black/40 rounded-lg p-2.5 border border-white/[0.03]">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color === 'red' ? 'bg-[#f12c4c]' : color === 'black' ? 'bg-[#2a2d35] border border-gray-600' : 'bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]'}`}></div>
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{name}</span>
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-gray-500 font-bold uppercase">SA</span>
          <span className="text-sm font-black text-[#00c83a] leading-none mt-0.5">{sa}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] text-gray-500 font-bold uppercase">SM</span>
          <span className="text-sm font-black text-gray-400 leading-none mt-0.5">{sm}</span>
        </div>
      </div>
    </div>
  );

  // Terminal Logs Profissional (Esquerda) - Ciclo assíncrono
  useEffect(() => {
    const sequence = [
      { delay: 300, log: { icon: '🟢', color: 'text-[#00c83a]', msg: 'Sourcing double hash configuration [ wss://stream ]' } },
      { delay: 300, log: { icon: '⚡', color: 'text-yellow-400', msg: 'Bypassing delay mechanisms...' } },
      { delay: 300, log: { icon: '📡', color: 'text-blue-400', msg: 'Establishing secure pipeline to live data' } },
      { delay: 300, log: { icon: '🟢', color: 'text-[#00c83a]', msg: 'Extraction initialized [ Target: Double ]' } },
      { delay: 300, log: { icon: '🔍', color: 'text-gray-400', msg: 'Parsing color distribution: R:48% B:42% W:10%' } },
      { delay: 300, log: { icon: '⚡', color: 'text-yellow-400', msg: 'Calculating absolute max delay for White hits' } },
      { delay: 300, log: { icon: '🟢', color: 'text-[#00c83a]', msg: 'Syncing historical blocks (24.050 rounds)' } },
      { delay: 300, log: { icon: '🛡️', color: 'text-purple-400', msg: 'Applying VIP assertiveness filters' } },
      { delay: 300, log: { icon: '🔍', color: 'text-gray-400', msg: 'Identifying V-V-P-P cluster sequence' } },
      { delay: 300, log: { icon: '🟢', color: 'text-[#00c83a]', msg: 'Primary pattern validated against database' } },
      { delay: 300, log: { icon: '⚡', color: 'text-yellow-400', msg: 'Adjusting engine probabilistic weights' } },
      { delay: 300, log: { icon: '📡', color: 'text-blue-400', msg: 'Monitoring sequence break points...' } },
      { delay: 300, log: { icon: '🟢', color: 'text-[#00c83a]', msg: 'Current cycle identified: MIXED / LOW FREQUENCY' } },
      { delay: 300, log: { icon: '🔍', color: 'text-gray-400', msg: 'Cross-referencing anomalies with 7-day data' } },
      { delay: 300, log: { icon: '⚡', color: 'text-yellow-400', msg: 'Detecting market inflection zones' } },
      { delay: 300, log: { icon: '🛡️', color: 'text-purple-400', msg: 'Anti-fake signal blockade activated' } },
      { delay: 300, log: { icon: '🟢', color: 'text-[#00c83a]', msg: 'Data matrix perfectly structured.' } },
      { delay: 400, log: { icon: '📡', color: 'text-blue-400', msg: 'Optimizing packet delivery (Delay: 42ms)' } },
      { delay: 500, log: { icon: '🔍', color: 'text-gray-400', msg: 'Isolating White hit probability...' } },
      { delay: 800, log: { icon: '⚡', color: 'text-yellow-400', msg: 'Scanning latest hashes for White triggers...' } },
      { delay: 2500, log: { icon: '⚪', color: 'text-white font-bold', msg: 'SEARCHING FOR WHITE PATTERN [ V-V-P-P ]...' } }, // Pausa dramática de 2.5s
      { delay: 3000, log: { icon: '🎯', color: 'text-[#00c83a] font-black', msg: 'VICTORY! WHITE HIT FOUND AND VALIDATED!' } },
      { delay: 4000, log: { icon: '🔄', color: 'text-gray-500', msg: 'Restarting data extraction cycle in 4s...' } }
    ];

    let isCancelled = false;

    const runSequence = async () => {
      while (!isCancelled) {
        setTerminalLogs([]); // Limpa o terminal a cada novo ciclo
        for (const step of sequence) {
          if (isCancelled) break;
          await new Promise(resolve => setTimeout(resolve, step.delay));
          if (isCancelled) break;
          setTerminalLogs(prev => {
            const newLogs = [...prev, step.log];
            if (newLogs.length > 36) newLogs.shift();
            return newLogs;
          });
        }
      }
    };

    runSequence();

    return () => {
      isCancelled = true;
    };
  }, []);
  
  // Auto-scroll do terminal
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Accordion Logic (Right side of Terminal)
  useEffect(() => {
    setProgressWidth(0); // reset bar
    const duration = 6000; // 6 seconds per card
    const tickRate = 50; // update every 50ms
    const totalTicks = duration / tickRate;
    let currentTick = 0;

    const interval = setInterval(() => {
      currentTick++;
      setProgressWidth((currentTick / totalTicks) * 100);
      
      if (currentTick >= totalTicks) {
        setActiveAccordion((prev) => (prev + 1) % 3);
        currentTick = 0;
        setProgressWidth(0);
      }
    }, tickRate);

    return () => clearInterval(interval);
  }, [activeAccordion]);


  const scrollToPlanos = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });
  };

  const PLANS = [
    {
      id: 'semanal',
      name: 'Acesso Semanal',
      days: 7,
      price: '27',
      time: '/ 7 dias',
      description: 'Uma semana inteira de análise profunda.',
      recommended: false,
      features: [
        'Acesso Completo ao Painel Master',
        'Cálculo ao Vivo em 20.000 Pedras',
        'Zonas Quentes do Branco',
        'Minutos Indicados pela IA',
        'Histórico Dinâmico & Pedras-Chaves',
        'Leitura de Padrões Complexos ao Vivo',
        'Gráfico PnL ao Vivo com Médias'
      ]
    },
    {
      id: 'quinzenal',
      name: 'Acesso Quinzenal',
      days: 15,
      price: '47',
      time: '/ 15 dias',
      description: 'Tempo ideal para criar método e consistência.',
      recommended: false,
      features: [
        'Acesso Completo ao Painel Master',
        'Cálculo ao Vivo em 20.000 Pedras',
        'Zonas Quentes do Branco',
        'Minutos Indicados pela IA',
        'Histórico Dinâmico & Pedras-Chaves',
        'Leitura de Padrões Complexos ao Vivo',
        'Gráfico PnL ao Vivo com Médias'
      ]
    },
    {
      id: 'mensal',
      name: 'Passe Mensal',
      days: 30,
      price: '57',
      time: '/ 30 dias',
      description: 'O melhor custo-benefício (30 dias).',
      recommended: true,
      features: [
        'Acesso Completo ao Painel Master',
        'Cálculo ao Vivo em 20.000 Pedras',
        'Zonas Quentes do Branco',
        'Minutos Indicados pela IA',
        'Histórico Dinâmico & Pedras-Chaves',
        'Leitura de Padrões Complexos ao Vivo',
        'Gráfico PnL ao Vivo com Médias'
      ]
    }
  ];

  const handleCheckout = async (days: number) => {
    if (days === 0) {
      alert("Lógica para plano gratuito será implementada em breve.");
      return;
    }
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
      
      {/* Background Grid com Red Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
         <div 
           className="absolute inset-0 opacity-[0.02]"
           style={{
             backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
             backgroundSize: '40px 40px'
           }}
         ></div>
         <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-[1200px] max-h-[1200px] bg-[#f12c4c]/[0.05] blur-[150px] rounded-full animate-pulse" style={{ animationDuration: '8s' }}></div>
      </div>
      
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none opacity-10">
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
      </div>

      <header className={`fixed top-0 w-full z-[100] transition-all duration-300 py-3 md:py-4 ${scrolled ? 'bg-[#050507]/80 backdrop-blur-xl border-b border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.8)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-3 group cursor-pointer shrink-0">
            <img src="/icon.svg" alt="Apex Machine" className="w-7 h-7 md:w-9 md:h-9 object-contain drop-shadow-[0_0_10px_rgba(241,44,76,0.5)] transition-transform group-hover:scale-110" />
            <h1 className="text-[16px] md:text-2xl font-black tracking-tighter flex gap-1 uppercase">
              <span className="text-[#f12c4c]">APEX</span>
              <span className="text-[#00c83a]">MACHINE</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link 
              href="/login" 
              className="px-3 sm:px-4 py-2 text-[10px] md:text-xs font-bold tracking-widest text-gray-300 hover:text-white uppercase transition-colors"
            >
              Entrar
            </Link>
            <button 
              onClick={scrollToPlanos}
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#00c83a] hover:bg-[#00a830] text-black font-black text-[10px] md:text-xs uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(0,200,58,0.3)] hover:shadow-[0_0_25px_rgba(0,200,58,0.5)] transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span>Assinar Agora</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Aviso removido daqui e passado para o fim das seções */}

      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-16 pb-20 z-10">
        <div className="text-center max-w-5xl mx-auto flex flex-col items-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00c83a]/10 border border-[#00c83a]/30 text-[10px] font-black uppercase tracking-widest text-[#00c83a] mb-8 shadow-[0_0_20px_rgba(0,200,58,0.15)] backdrop-blur-md">
              <Database size={14} />
              <span>Análise Pura de Dados Históricos</span>
            </div>
            
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.1] mb-6 text-white uppercase">
              Chega de operar o Double <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f12c4c] to-[#eab308] drop-shadow-[0_0_30px_rgba(241,44,76,0.3)]">
                no achismo.
              </span>
            </h2>
            
            <p className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl mx-auto mb-8 leading-relaxed">
              A Apex Machine é a central de análise para quem quer ler padrões, visualizar contexto e tomar decisões com mais critério — <strong className="text-white font-bold">sem depender de sala de sinais, guru ou impulso.</strong>
            </p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="w-full max-w-6xl mx-auto mt-16 sm:mt-24 relative h-[440px] sm:h-[460px] md:h-[500px]"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-[#00c83a]/20 via-[#f12c4c]/20 to-[#eab308]/20 blur-3xl opacity-30"></div>
          
          {/* Badge 1: Top-Left (Status Engine API) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute -top-10 sm:-top-12 left-1 sm:-left-4 md:-left-8 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-xl border border-[#00c83a]/40 shadow-[0_0_20px_rgba(0,200,58,0.25)] flex items-center gap-2 font-mono"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#00c83a]/10 border border-[#00c83a]/30 flex items-center justify-center text-[#00c83a] shrink-0">
              <Activity size={14} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Status Engine</span>
              <span className="text-[11px] sm:text-xs font-black text-[#00c83a] flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00c83a] animate-ping"></span>
                Double API: On (42ms)
              </span>
            </div>
          </motion.div>

          {/* Badge 2: Top-Right (Base de Dados 20k / 250k) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.4 }}
            className="absolute -top-10 sm:-top-12 right-1 sm:-right-4 md:-right-8 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-xl border border-yellow-500/40 shadow-[0_0_20px_rgba(234,179,8,0.25)] flex items-center gap-2 font-mono"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 shrink-0">
              <Database size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Base ao Vivo</span>
              <span className="text-[11px] sm:text-xs font-black text-white leading-none">
                20.000+ <span className="text-yellow-400 font-bold sm:inline hidden">(Consulta 250k)</span>
              </span>
            </div>
          </motion.div>

          {/* Badge 3: Bottom-Right (Alerta Xadrez & Surf) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.6 }}
            className="absolute -bottom-6 sm:-bottom-8 right-2 sm:-right-4 md:-right-8 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl py-2 px-3.5 rounded-xl border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.25)] flex items-center gap-2.5 font-mono hidden sm:flex"
          >
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <BrainCircuit size={15} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Alerta de Recorrência</span>
              <span className="text-xs font-black text-white leading-none">Padrões Xadrez & Surf Mapeados</span>
            </div>
          </motion.div>
          
          <div className="relative w-full h-full bg-black/40 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden flex flex-col ring-1 ring-white/5">
            <div className="h-12 bg-white/[0.03] border-b border-white/5 flex items-center px-6 gap-6 shrink-0">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              </div>
              <div className="flex gap-4 text-sm font-black text-white tracking-widest uppercase opacity-90">
                CENTRAL APEX • RADAR & ZONAS QUENTES
              </div>
            </div>
            <div className="relative w-full h-[450px] md:h-[500px] flex bg-white/[0.01]">
               <AnimatePresence mode="wait">
                  {heroImageIndex === 0 ? (
                    <motion.div
                      key="img0"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 flex flex-col bg-[#0a0a0f] p-5 justify-center items-center overflow-hidden w-full h-full"
                    >
                       <div className="w-full max-w-3xl flex flex-col items-center">
                         <div className="flex items-center gap-2 mb-8 mr-auto">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#f12c4c] animate-pulse shadow-[0_0_10px_rgba(241,44,76,0.8)]"></div>
                            <span className="text-xs text-gray-400 font-black uppercase tracking-widest">AO VIVO (SEQUÊNCIA)</span>
                         </div>
                         
                         <div className="flex flex-col gap-3 w-full">
                            {/* 4 Pedras */}
                            <div className="bg-[#12141a] rounded-xl p-5 border border-white/5 flex flex-col w-full shadow-lg">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-sm text-white font-black uppercase tracking-widest">4 Pedras</span>
                                  <div className="flex gap-2 items-center">
                                     <span className="text-[10px] text-[#f12c4c] border border-[#f12c4c]/30 bg-[#f12c4c]/10 px-2 py-0.5 rounded font-black">13</span>
                                     <span className="text-xs text-[#00c83a] font-black">100%</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 mb-6">
                                   <div className="w-10 h-10 rounded border border-white/10 bg-[#1a1c23]"></div>
                                   <div className="w-10 h-10 rounded border border-white/10 bg-[#1a1c23]"></div>
                                   <div className="w-10 h-10 rounded border border-white/10 bg-[#1a1c23]"></div>
                                   <div className="w-10 h-10 rounded border border-white/10 bg-[#1a1c23]"></div>
                                   <span className="text-gray-600 mx-2 text-lg">→</span>
                                   <div className="w-10 h-10 rounded-xl bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] flex items-center justify-center">
                                      <img src="/blaze-white.png" className="w-6 h-6 object-contain" alt="W" />
                                   </div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest border-t border-white/5 pt-4">
                                  <div className="flex flex-col gap-1.5">
                                     <span>Geral</span>
                                     <span>Finalizando c/ N° 10</span>
                                  </div>
                                  <div className="flex flex-col gap-1.5 items-end">
                                     <span className="text-white font-black tracking-wider">(40x) <span className="text-gray-300">17.5%</span></span>
                                     <span className="text-[#00c83a] font-black tracking-wider">(2x) <span className="text-[#00c83a]/80">0.0%</span></span>
                                  </div>
                                </div>
                            </div>
                         </div>
                       </div>
                       
                       <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1 }}
                          className="absolute bottom-6 w-full flex justify-center z-10"
                       >
                          <div className="bg-[#050507] px-6 py-3 rounded-lg border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,1)]">
                             <span className="text-white text-xs font-black uppercase tracking-widest">
                               Oportunidade que nenhum humano calcularia a tempo.
                             </span>
                          </div>
                       </motion.div>
                    </motion.div>
                  ) : heroImageIndex === 1 ? (
                    <motion.div
                      key="img1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 flex flex-col bg-[#0a0a0f] items-center justify-center overflow-hidden p-6 w-full h-full"
                    >
                       <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-10 mt-10 relative">
                          {[
                             { num: 10, time: '20:19', active: false },
                             { num: 11, time: '20:19', active: false },
                             { num: 12, time: '20:20', active: false },
                             { num: 8, time: '20:20', active: false },
                             { num: 8, time: '20:21', active: false },
                          ].map((item, idx) => (
                             <motion.div 
                               initial={{ opacity: 0, scale: 0.8 }}
                               animate={{ opacity: 1, scale: 1 }}
                               transition={{ delay: idx * 0.1 }}
                               key={idx} className="flex flex-col items-center gap-3"
                             >
                                <div className="w-12 h-14 rounded-xl flex items-center justify-center font-black text-lg bg-[#1a1c23] border border-gray-700 text-white shadow-lg">
                                   <div className="w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center">{item.num}</div>
                                </div>
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{item.time}</span>
                             </motion.div>
                          ))}
                          
                          {/* WHITE STONE ANIMATION */}
                          <motion.div 
                             initial={{ opacity: 0, scale: 0, x: -50 }}
                             animate={{ opacity: 1, scale: 1, x: 0 }}
                             transition={{ delay: 1, type: "spring", stiffness: 200, damping: 15 }}
                             className="flex flex-col items-center gap-3 relative z-10"
                          >
                             {/* CONFETTI BURST */}
                             {[...Array(12)].map((_, i) => (
                               <motion.div
                                 key={`confetti-${i}`}
                                 initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                                 animate={{ 
                                   opacity: [0, 1, 0], 
                                   x: (Math.random() - 0.5) * 150, 
                                   y: (Math.random() - 0.5) * 150,
                                   scale: [0, 1.5, 0.5],
                                   rotate: Math.random() * 360
                                 }}
                                 transition={{ delay: 1.1, duration: 1, ease: "easeOut" }}
                                 className={`absolute top-1/2 left-1/2 w-2 h-2 rounded-sm ${['bg-[#00c83a]', 'bg-white', 'bg-[#eab308]', 'bg-[#00c83a]'][i % 4]}`}
                               />
                             ))}

                             {/* FLOATING WIN TEXT */}
                             <motion.div
                               initial={{ opacity: 0, y: 20, scale: 0.5 }}
                               animate={{ opacity: [0, 1, 1, 0], y: -50, scale: [0.5, 1.5, 1.2, 1] }}
                               transition={{ delay: 1.3, duration: 2, ease: "easeOut" }}
                               className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                             >
                               <span className="text-[#00c83a] font-black text-2xl drop-shadow-[0_0_15px_rgba(0,200,58,0.8)] tracking-tighter italic">WIN!</span>
                             </motion.div>

                             <div className="w-12 h-14 rounded-xl flex items-center justify-center font-black text-lg transition-all duration-500 bg-white shadow-[0_0_40px_rgba(255,255,255,0.8)] scale-110 relative z-10 border-2 border-[#00c83a]/50">
                                <img src="/blaze-white.png" className="w-7 h-7 object-contain drop-shadow-md" alt="W" />
                             </div>
                             <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">20:21</span>
                          </motion.div>
                       </div>
                       
                       <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: 1 }}
                       >
                          <div className="bg-[#00c83a]/10 px-5 py-3 rounded-lg border border-[#00c83a]/30 shadow-[0_0_30px_rgba(0,200,58,0.15)] flex items-center gap-3">
                             <CheckCircle2 size={16} className="text-[#00c83a]" />
                             <span className="text-[#00c83a] text-xs font-black uppercase tracking-widest">
                               Padrão validado. O sistema analisa, a matemática comprova.
                             </span>
                          </div>
                       </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="img2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 flex flex-col bg-[#050505] overflow-hidden group w-full h-full font-mono select-none"
                    >
                       {/* High-Fidelity ZONAS QUENTES Panel (Exact Replica from /avancado) */}
                       <div className="absolute inset-0 z-0 flex flex-col p-3 sm:p-4 md:p-5 bg-[#0a0d14] justify-between text-sans select-none overflow-y-auto custom-scrollbar">
                          
                          {/* Top Navigation & Settings Bar */}
                          <div className="flex flex-col gap-1.5 border-b border-white/10 pb-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#00c83a] animate-ping"></span>
                                <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-wider">ZONAS QUENTES</h4>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-bold">
                                <span className="text-gray-400">Atraso: <strong className="text-white">21</strong></span>
                                <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
                                  <span className="bg-[#00c83a] text-black px-2 py-0.5 rounded font-black">5</span>
                                  <span className="text-gray-400 px-2 py-0.5 font-bold">10</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-gray-400">
                              <span className="flex items-center gap-1"><span className="text-[#00c83a]">•</span> PERÍODO DE ANÁLISE</span>
                              <div className="flex items-center gap-1.5">
                                <span>GERAL: <span className="bg-black/60 text-white px-1.5 sm:px-2 py-0.5 rounded border border-white/10">3h ▾</span></span>
                                <span>CICLO: <span className="bg-black/60 text-white px-1.5 sm:px-2 py-0.5 rounded border border-white/10">48h ▾</span></span>
                              </div>
                            </div>
                          </div>

                          {/* 2 Rows x 3 Columns Cards Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5 my-1.5 flex-1 items-stretch">
                            {[
                              { house: 'CASA 1 A 5', win: '21.1%', wins: 4, losses: 15, cycle: 'Ciclo 3 Loss (25%)', stones: [2,1,9,1,1,1,3], flame: false, active: false },
                              { house: 'CASA 6 A 10', win: '20.0%', wins: 3, losses: 12, cycle: 'Ciclo 4 Loss (24%)', stones: [4,1,1,1,3,1,4], flame: false, active: false },
                              { house: 'CASA 11 A 15', win: '88.5%', wins: 18, losses: 2, cycle: 'Ciclo 8 WIN (88%)', stones: [1,2,2,7], flame: true, active: false },
                              { house: 'CASA 16 A 20', win: '33.3%', wins: 3, losses: 6, cycle: 'Ciclo 1 Loss (23%)', stones: [2,5,1,1], flame: false, active: false },
                              { house: 'CASA 21 A 25', win: '92.0%', wins: 24, losses: 2, cycle: 'Ciclo 9 WIN (92%)', stones: [3,1,1], flame: true, active: true },
                              { house: 'CASA 26 A 30', win: '25.0%', wins: 1, losses: 3, cycle: 'Ciclo 2 Loss (22%)', stones: [1,1,2], flame: false, active: false }
                            ].map((card, idx) => {
                              const isHot = card.flame;
                              return (
                                <div 
                                  key={idx}
                                  className={`rounded-xl p-3 border flex flex-col justify-between relative transition-all duration-300 ${
                                    card.active
                                      ? 'bg-[#061f12] border-[#00c83a] shadow-[0_0_20px_rgba(0,200,58,0.3)] ring-1 ring-[#00c83a]'
                                      : isHot
                                      ? 'bg-[#0c1a14] border-[#00c83a]/60 shadow-[0_0_15px_rgba(0,200,58,0.2)]'
                                      : 'bg-[#140c10] border-[#2a1720]'
                                  }`}
                                >
                                  {/* Card Header */}
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-black tracking-wider uppercase ${card.active || isHot ? 'text-[#00c83a]' : 'text-gray-400'}`}>
                                      {card.house}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {isHot && (
                                        <Flame size={14} className="text-orange-500 fill-orange-500 animate-bounce" />
                                      )}
                                      {card.active && (
                                        <span className="text-[9px] bg-[#00c83a] text-black font-black px-1.5 py-0.5 rounded uppercase">
                                          ATIVO
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Win Rate Stat */}
                                  <div className="my-1">
                                    <span className="text-lg md:text-xl font-black text-white tracking-tight">{card.win}</span>
                                    <span className="text-[10px] font-bold text-gray-500 ml-1">Win</span>
                                    <div className="flex items-center gap-3 text-[9px] font-bold mt-0.5">
                                      <span className="text-[#00c83a]">{card.wins} Win</span>
                                      <span className="text-rose-500">{card.losses} Loss</span>
                                    </div>
                                  </div>

                                  {/* Stone Dots Row */}
                                  <div className="flex items-center gap-1 my-1 overflow-x-auto py-1">
                                    {card.stones.map((st, i) => {
                                      const isGreen = i % 2 !== 0 || isHot;
                                      return (
                                        <span 
                                          key={i} 
                                          className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                                            isGreen 
                                              ? 'bg-[#0d331a] text-[#00c83a] border border-[#00c83a]/30' 
                                              : 'bg-[#3a151b] text-[#f12c4c] border border-[#f12c4c]/30'
                                          }`}
                                        >
                                          {st}
                                        </span>
                                      );
                                    })}
                                  </div>

                                  {/* Card Footer Status */}
                                  <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-1 text-[9px]">
                                    <div>
                                      <span className="text-gray-500 block uppercase font-bold text-[8px]">ESTADO ATUAL</span>
                                      <span className={`font-black ${isHot ? 'text-[#00c83a]' : 'text-rose-400'}`}>
                                        {card.cycle}
                                      </span>
                                    </div>
                                    <button className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-[8px] px-2 py-1 rounded transition-colors uppercase">
                                      Análise
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>
          </div>
        </motion.div>
        <WarningDisclaimer />
      </section>

      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <Target size={48} className="text-[#f12c4c] mb-6 opacity-80 drop-shadow-[0_0_15px_rgba(241,44,76,0.5)]" />
          <h3 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase text-white tracking-tighter mb-8 leading-tight">
            Se você busca um robô que aperta botão sozinho, <span className="text-[#f12c4c]">feche esta página.</span>
          </h3>
          <p className="text-gray-400 text-lg leading-relaxed mb-6">
            Não prometemos garantias mágicas, nem 100% de green. A Apex Machine foi desenhada para operadores analíticos que querem visualizar a matemática exata antes de dar um clique.
          </p>
          <p className="text-white text-lg leading-relaxed mb-10 font-bold">
            Entrar no mercado sem contexto, baseando-se apenas em feeling ou na dica de um "guru", é o caminho mais rápido para quebrar a banca. A diferença entre operar no impulso e operar com análise começa na tela que você olha.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-md group hover:border-white/10 transition-colors">
              <h4 className="text-[#f12c4c] font-black uppercase tracking-widest text-sm mb-4 border-b border-white/5 pb-2">O Analista no Escuro:</h4>
              <ul className="space-y-3">
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Copia chamadas cegas sem entender a lógica estatística.</li>
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Confunde sequências de quebra com "oportunidades de ouro".</li>
                <li className="text-gray-400 text-sm flex items-start gap-2"><span className="text-[#f12c4c]">✖</span> Desiste da própria autonomia e depende de terceiros.</li>
              </ul>
            </div>
            <div className="bg-white/[0.02] border border-[#00c83a]/20 rounded-xl p-6 relative overflow-hidden backdrop-blur-md group hover:border-[#00c83a]/40 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00c83a]/5 to-transparent pointer-events-none"></div>
              <h4 className="text-[#00c83a] font-black uppercase tracking-widest text-sm mb-4 border-b border-white/5 pb-2 relative z-10">O Operador com Contexto:</h4>
              <ul className="space-y-3 relative z-10">
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Vê a dispersão visual completa antes de entrar no mercado.</li>
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Conhece a máxima de atraso do padrão estatístico do dia.</li>
                <li className="text-gray-300 font-medium text-sm flex items-start gap-2"><span className="text-[#00c83a]">✔</span> Possui total autonomia para avaliar se o risco compensa.</li>
              </ul>
            </div>
          </div>
        </div>
        <WarningDisclaimer />
      </section>

      <section className="py-24 px-6 relative z-10 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-400 w-fit backdrop-blur-sm">
              <Database size={14} />
              Processamento Bruto
            </div>
            <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white leading-tight mb-4">
              Visualização que <br/>
              <span className="text-[#00c83a]">descomplica.</span>
            </h3>
            <p className="text-gray-400 text-lg">
              Deixamos a matemática pesada invisível e expomos para você apenas os gráficos vitais. **Pesquisa histórica em até 345.000 rodadas**, scanner de padrões ao vivo e confluência avançada.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                { icon: <Database size={18} className="text-[#00c83a]" />, title: "Scanner de 345k Rodadas", desc: "Varredura e catalogação em uma base de até 345.000 rodadas." },
                { icon: <Activity size={18} className="text-yellow-400" />, title: "Padrões Complexos", desc: "Mapeamento ao vivo de Duplos, Triplos, Dentados e Banguela." },
                { icon: <BrainCircuit size={18} className="text-purple-400" />, title: "Minutos da IA", desc: "Mapeamento dos minutos estatísticos com maior propensão de acerto." },
                { icon: <Flame size={18} className="text-orange-500" />, title: "Zonas Quentes do Branco", desc: "Análise das janelas de horários com maior densidade de Brancos." },
                { icon: <ShieldCheck size={18} className="text-cyan-400" />, title: "Mestres da Confluência", desc: "Cruzamento de múltiplos radares para validação de sinais." },
                { icon: <BarChart2 size={18} className="text-rose-500" />, title: "Gráfico PnL da Plataforma", desc: "Acompanhamento visual da variação de PnL e desempenho do mercado." },
              ].map((card, i) => (
                <div key={i} className="group flex items-start gap-3 bg-white/[0.02] border border-white/[0.05] p-3.5 rounded-2xl hover:bg-white/[0.05] hover:border-white/20 transition-all backdrop-blur-md cursor-default">
                   <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform mt-0.5">
                     {card.icon}
                   </div>
                   <div>
                     <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-0.5">{card.title}</h4>
                     <p className="text-gray-400 text-[11px] leading-snug">{card.desc}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>

          {/* NOVO PAINEL "VISÃO GERAL" ATUALIZANDO AO VIVO */}
          <div className="h-full w-full bg-[#0a0a0f] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group">
             {/* Header */}
             <div className="flex items-center gap-3 border-b border-white/5 pb-5 mb-8 relative z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00c83a] shadow-[0_0_12px_rgba(0,200,58,0.8)] animate-pulse"></div>
                <h4 className="text-white font-black text-sm md:text-base tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">VISÃO GERAL</h4>
             </div>

             <div className="flex-1 flex flex-col justify-center">
                 <div className="flex flex-col gap-10">
                       {/* Top: Donut Chart + Percentages */}
                       <div className="flex flex-col sm:flex-row items-center justify-center gap-8 md:gap-14">
                          {/* Donut Chart */}
                          <div className="relative w-36 h-36 flex items-center justify-center transition-all duration-300">
                             <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                               <circle cx="50" cy="50" r="40" fill="none" stroke="#12141a" strokeWidth="16" />
                               <circle cx="50" cy="50" r="40" fill="none" stroke="#f12c4c" strokeWidth="16" strokeDasharray={`${251.2 * (currentStoneData.global.redPct / 100)} 251.2`} className="transition-all duration-500 ease-in-out" />
                               <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2d35" strokeWidth="16" strokeDasharray={`${251.2 * (currentStoneData.global.blackPct / 100)} 251.2`} strokeDashoffset={`-${251.2 * (currentStoneData.global.redPct / 100)}`} className="transition-all duration-500 ease-in-out" />
                               <circle cx="50" cy="50" r="40" fill="none" stroke="#ffffff" strokeWidth="16" strokeDasharray={`${251.2 * (currentStoneData.global.whitePct / 100)} 251.2`} strokeDashoffset={`-${251.2 * ((currentStoneData.global.redPct + currentStoneData.global.blackPct) / 100)}`} className="transition-all duration-500 ease-in-out" />
                             </svg>
                             <div className="absolute flex flex-col items-center justify-center">
                               <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">TOTAL</span>
                               <span className="text-2xl font-black text-white">{currentStoneData.global.total}</span>
                             </div>
                          </div>
                          
                          {/* Percentages */}
                          <div className="flex flex-col gap-4">
                             <div className="flex items-center gap-3">
                               <div className="w-2.5 h-2.5 rounded-full bg-[#f12c4c]"></div>
                               <div className="flex flex-col">
                                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">VERMELHO</span>
                                 <span className="text-sm font-black text-white leading-none mt-1 transition-all">{currentStoneData.global.redPct}%</span>
                               </div>
                             </div>
                             <div className="flex items-center gap-3">
                               <div className="w-2.5 h-2.5 rounded-full bg-[#2a2d35]"></div>
                               <div className="flex flex-col">
                                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">PRETO</span>
                                 <span className="text-sm font-black text-white leading-none mt-1 transition-all">{currentStoneData.global.blackPct}%</span>
                               </div>
                             </div>
                             <div className="flex items-center gap-3">
                               <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                               <div className="flex flex-col">
                                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">BRANCO</span>
                                 <span className="text-sm font-black text-white leading-none mt-1 transition-all">{currentStoneData.global.whitePct}%</span>
                               </div>
                             </div>
                          </div>
                       </div>

                       {/* Bottom: Two columns */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                          {/* ATRASO GLOBAL */}
                          <div className="bg-[#12141a] rounded-2xl p-5 border border-white/5 flex flex-col">
                             <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-5 text-center">ATRASO GLOBAL</h5>
                             <div className="flex flex-col gap-3">
                                <GlobalDelayRow color="red" name="VERMELHO" sa={currentStoneData.global.redSA} sm={currentStoneData.global.redSM} />
                                <GlobalDelayRow color="black" name="PRETO" sa={currentStoneData.global.blackSA} sm={currentStoneData.global.blackSM} />
                                <GlobalDelayRow color="white" name="BRANCO" sa={currentStoneData.global.whiteSA} sm={currentStoneData.global.whiteSM} />
                             </div>
                          </div>

                          {/* PÓS [ Pedra ] */}
                          <div className="bg-[#12141a] rounded-2xl p-5 border border-[#00c83a]/20 shadow-[0_0_20px_rgba(0,200,58,0.05)] flex flex-col relative overflow-hidden transition-all duration-300">
                             
                             <div className="flex items-center justify-center gap-3 mb-5 relative z-10">
                               <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-widest transition-all">PÓS</h5>
                               <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shadow-lg transition-all duration-300 ${
                                 currentStoneData.stone.color === 'red' ? 'bg-[#f12c4c] text-white shadow-[0_0_15px_rgba(241,44,76,0.4)]' :
                                 currentStoneData.stone.color === 'black' ? 'bg-[#2a2d35] text-white' :
                                 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.6)]'
                               }`}>
                                 {currentStoneData.stone.number === 'flame' ? <img src="/blaze-white.png" alt="W" className="w-[18px] h-[18px] object-contain drop-shadow-md" /> : currentStoneData.stone.number}
                               </div>
                             </div>

                             <div className="flex flex-col gap-3 relative z-10">
                                {currentStoneData.posData.map((pos, idx) => (
                                  <GlobalDelayRow key={idx} color={pos.color} name={pos.name} sa={pos.sa} sm={pos.sm} />
                                ))}
                             </div>
                          </div>
                       </div>
                 </div>
             </div>
          </div>
        </div>
        <WarningDisclaimer />
      </section>

      {/* ANÁLISE DE BRANCOS (Logs e Accordion) */}
      <section className="py-32 px-6 relative z-10 border-t border-white/[0.05]">
         <div className="max-w-6xl mx-auto flex flex-col items-center mb-16 text-center">
            <h3 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Terminal Ao Vivo
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl">
              Acompanhe em tempo real enquanto nossa engine faz o trabalho pesado, varrendo milhares de dados matemáticos em milissegundos para entregar a análise mais precisa do mercado.
            </p>
         </div>

         <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1.5fr] gap-8">
            
            {/* Terminal de Logs Profissional */}
            <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl h-[450px] flex flex-col shadow-2xl">
              <div className="h-10 bg-[#12141c] flex items-center px-4 gap-2 border-b border-white/5 shrink-0">
                 <div className="flex gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
                   <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                 </div>
                 <span className="ml-4 text-xs font-mono text-gray-500">Apex Server Data Engine</span>
                 <div className="ml-auto flex items-center gap-2">
                   <div className="w-2 h-2 bg-[#00c83a] rounded-full animate-pulse"></div>
                   <span className="text-[9px] text-[#00c83a] font-bold uppercase tracking-widest">Online</span>
                 </div>
              </div>
              
              <div 
                ref={terminalScrollRef}
                className="p-4 font-mono text-[11px] sm:text-xs space-y-1.5 overflow-y-auto flex-1 flex flex-col custom-scrollbar"
              >
                 {terminalLogs.map((log, i) => (
                   <div 
                     key={i} 
                     className="flex gap-3"
                   >
                     <span className="shrink-0 text-white/[0.15] select-none">[ {log.icon} ]</span>
                     <span className={log.color}>{log.msg}</span>
                   </div>
                 ))}
                 
                 {/* Cursor piscando indicando processamento contínuo */}
                 <div className="flex gap-3 text-gray-500 mt-1">
                    <span className="shrink-0 text-transparent select-none">[ - ]</span>
                    <span className="animate-pulse bg-gray-500 w-1.5 h-3.5 mt-0.5"></span>
                 </div>
              </div>
            </div>

            {/* Accordion (A14X Style) */}
            <div className="flex flex-col gap-4 h-[450px]">
               {[
                 { 
                   num: '01', 
                   title: 'Leitura de Mercado ao Vivo', 
                   desc: 'Nossa engine processa milhares de rodadas por segundo, identificando tendências matemáticas e ciclos invisíveis a olhos destreinados.',
                   icon: <Database size={16} />
                 },
                 { 
                   num: '02', 
                   title: 'Filtro de Padrões Premium', 
                   desc: 'Algoritmos avançados filtram o ruído do cassino para entregar apenas as zonas de interesse de alta assertividade. Acompanhamento exato das máximas do dia.',
                   icon: <Cpu size={16} />
                 },
                 { 
                   num: '03', 
                   title: 'Matriz de Zonas Quentes (Horários VIP)', 
                   desc: 'Saiba exatamente os melhores horários do dia para operar. Nosso algoritmo cruza os ciclos de pagamento da Blaze e revela as janelas com maior frequência de Brancos.',
                   icon: <Flame size={16} />
                 }
               ].map((card, idx) => {
                 const isActive = activeAccordion === idx;
                 return (
                   <div 
                     key={idx}
                     className={`relative border rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer ${
                       isActive ? 'bg-white/[0.03] border-[#f12c4c]/50 shadow-[0_0_30px_rgba(241,44,76,0.1)] flex-[1.5]' : 'bg-white/[0.01] border-white/5 hover:border-white/10 flex-1 flex items-center'
                     }`}
                     onClick={() => {
                        setActiveAccordion(idx);
                        setProgressWidth(0); // reset if clicked manually
                     }}
                   >
                      <div className={`p-5 flex flex-col h-full ${isActive ? 'justify-between' : 'justify-center'}`}>
                         <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-500 ${isActive ? 'bg-[#f12c4c] text-white shadow-[0_0_15px_rgba(241,44,76,0.4)]' : 'bg-white/5 text-gray-500'}`}>
                              {card.icon}
                           </div>
                           <h4 className={`text-sm font-black tracking-widest uppercase transition-colors duration-500 flex-1 ${isActive ? 'text-white' : 'text-gray-500'}`}>
                             {card.title}
                           </h4>
                           <span className={`text-[10px] font-mono transition-colors duration-500 ${isActive ? 'text-[#f12c4c]' : 'text-gray-600'}`}>
                             {card.num}
                           </span>
                         </div>
                         
                         <AnimatePresence>
                           {isActive && (
                             <motion.div 
                               initial={{ opacity: 0, height: 0 }}
                               animate={{ opacity: 1, height: 'auto' }}
                               exit={{ opacity: 0, height: 0 }}
                               transition={{ duration: 0.3 }}
                               className="mt-4 text-xs text-gray-400 leading-relaxed font-medium pl-14"
                             >
                               {card.desc}
                               
                               {/* Progress Bar Container */}
                               <div className="w-full h-0.5 bg-white/5 mt-6 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-[#f12c4c] shadow-[0_0_10px_rgba(241,44,76,0.8)]" 
                                    style={{ width: `${progressWidth}%` }}
                                  ></div>
                               </div>
                             </motion.div>
                           )}
                         </AnimatePresence>
                      </div>
                   </div>
                 );
               })}
            </div>

         </div>
        <WarningDisclaimer />
      </section>

      {/* PLANOS / NÍVEL DE ACESSO (Free, 15d, 30d) */}
      <section id="planos" className="py-32 px-6 relative z-10 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase text-white tracking-tighter mb-4">
              Nível de <span className="text-[#00c83a]">Acesso</span>
            </h3>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Adquira a infraestrutura de dados para o seu operacional. Liberamos o acesso imediatamente após o processamento.
            </p>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 backdrop-blur-md group ${
                plan.recommended
                  ? 'bg-[#00c83a]/5 border border-[#00c83a]/50 shadow-[0_0_50px_rgba(0,200,58,0.15)] lg:-translate-y-4 z-10'
                  : 'bg-white/[0.02] border border-white/[0.05] hover:border-white/20'
              }`}
            >
               {plan.recommended && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00c83a] text-black text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest uppercase shadow-[0_0_15px_rgba(0,200,58,0.5)] whitespace-nowrap">
                   Mais Escolhido • Melhor Oferta
                 </div>
               )}
               
               <div className="mb-6 mt-2 border-b border-white/10 pb-6 text-center">
                 <h4 className={`text-sm font-black tracking-widest uppercase mb-4 ${plan.recommended ? 'text-[#00c83a]' : 'text-white'}`}>{plan.name}</h4>
                 <div className="flex items-end justify-center gap-1">
                   <span className="text-gray-400 font-bold text-sm mb-1">R$</span>
                   <span className={`text-6xl font-black tracking-tighter text-white leading-none`}>{plan.price}</span>
                   <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest ml-1 mb-1">{plan.time}</span>
                 </div>
                 {plan.id === 'mensal' && (
                   <div className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#00c83a]/15 border border-[#00c83a]/40 text-[11px] font-black text-[#00c83a] shadow-[0_0_15px_rgba(0,200,58,0.2)]">
                     <span>Equivale a apenas R$ 1,90 por dia! 🔥</span>
                   </div>
                 )}
               </div>
               
               <p className="text-gray-400 text-xs text-center font-medium leading-relaxed mb-6">
                 {plan.description}
               </p>

               <ul className="flex flex-col gap-3 mb-8 flex-grow">
                 {plan.features.map((feature, i) => (
                   <li key={i} className="flex items-start gap-2 text-xs text-gray-300 font-medium">
                     <CheckCircle2 size={14} className="text-[#00c83a] shrink-0 mt-0.5" />
                     {feature}
                   </li>
                 ))}
               </ul>
               
               <button 
                 onClick={() => handleCheckout(plan.days)}
                 disabled={loading !== null}
                 className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center items-center gap-2 ${
                   plan.recommended 
                    ? 'bg-[#00c83a] hover:bg-[#00a830] text-black shadow-[0_0_20px_rgba(0,200,58,0.3)] hover:shadow-[0_0_30px_rgba(0,200,58,0.5)]' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                 }`}
               >
                 {loading === String(plan.days) ? 'Processando...' : (plan.price === '0' ? 'Acessar Grátis' : 'Assinar Agora')}
                 {loading !== String(plan.days) && <Lock size={14} className={plan.recommended ? 'text-black' : 'text-gray-400'} />}
               </button>
            </div>
          ))}
        </div>
        

        </div>
        <WarningDisclaimer />
      </section>

      {/* CTA FINAL DE CONTATO */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5 bg-[#050507]">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <HelpCircle size={48} className="text-[#00c83a] mb-6 opacity-50" />
          <h3 className="text-2xl md:text-4xl lg:text-5xl font-black uppercase text-white tracking-tighter mb-6">
            Ainda tem <span className="text-[#00c83a]">dúvidas?</span>
          </h3>
          <p className="text-gray-400 text-lg mb-10 max-w-xl">
            Se você quer ver o terminal funcionando na prática antes de assinar, ou tem dúvidas técnicas sobre a extração de dados, entre em contato direto pelo suporte.
          </p>
          <a 
            href="https://wa.me/5547991523220?text=Ol%C3%A1%2C+vim+pelo+Apex+Machine+e+tenho+uma+d%C3%BAvida."
            target="_blank"
            className="px-10 py-5 bg-white/[0.05] border border-white/10 hover:bg-white/10 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 backdrop-blur-md flex items-center gap-3"
          >
            Falar com o Suporte
            <MessageCircle size={18} />
          </a>
        </div>
        <WarningDisclaimer />
      </section>

      {/* FLOATING TELEGRAM BUTTON */}
      <a 
        href="https://t.me/sup_apexmachine" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#2AABEE] hover:bg-[#2298d6] rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(42,171,238,0.5)] transition-all hover:scale-110"
      >
        <Send size={24} className="-ml-1" />
      </a>

      {/* FOOTER PROFISSIONAL - PROTEÇÃO LEGAL */}
      <footer className="pt-20 pb-10 border-t border-white/10 text-center relative z-10 bg-[#020202]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center gap-10">
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 text-left bg-white/[0.02] border border-white/5 p-8 rounded-2xl w-full max-w-4xl backdrop-blur-md">
             <div className="w-12 h-12 bg-[#f12c4c]/10 border border-[#f12c4c]/20 rounded-full flex items-center justify-center shrink-0">
               <ShieldCheck size={20} className="text-[#f12c4c]" />
             </div>
             <div>
               <p className="text-sm text-white font-black uppercase tracking-widest mb-2">
                 Disclaimer Técnico e Responsabilidade de Uso
               </p>
               <p className="text-xs text-gray-500 font-medium leading-relaxed">
                 A Apex Machine é estritamente uma plataforma provedora de software para mapeamento visual, histórico e organização de dados estatísticos. **Nós não somos uma casa de apostas, não prevemos o futuro matemático, não enviamos sinais garantidos e não processamos transações em nome de terceiros.** Qualquer decisão financeira ou entrada realizada em plataformas de terceiros utilizando as métricas estruturadas pelo nosso painel é de total e absoluta responsabilidade do usuário. O mercado possui alta volatilidade e o usuário assume os riscos inerentes a essas operações.
               </p>
             </div>
          </div>

          <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white opacity-40">
            A matemática do momento.
          </h4>

          <div className="flex flex-col gap-4 text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">
             <div className="flex flex-wrap justify-center items-center gap-4">
                <span>Plataformas Mapeadas para extração de API:</span>
                <span className="text-white bg-white/5 px-3 py-1 rounded-md border border-white/10">Blaze</span>
                <span className="text-white bg-white/5 px-3 py-1 rounded-md border border-white/10 opacity-50">Jonbet (Em Breve)</span>
             </div>
             
             <div className="flex flex-wrap justify-center gap-6 mt-6">
                <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
                <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
                <a href="#" className="hover:text-white transition-colors">Suporte Técnico</a>
             </div>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <a href="mailto:sup_apexmachine@gmail.com" title="E-mail" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
               <Mail size={16} />
            </a>
            <a href="https://t.me/sup_apexmachine" target="_blank" rel="noopener noreferrer" title="Telegram" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-[#2AABEE] hover:bg-white/10 transition-colors">
               <Send size={14} className="-ml-0.5" />
            </a>
          </div>

          <div className="w-full border-t border-white/5 pt-8 mt-4 flex flex-col items-center gap-4">
            <div className="text-[10px] font-bold text-gray-600 tracking-widest uppercase">
              © {new Date().getFullYear()} APEX MACHINE. TODOS OS DIREITOS RESERVADOS SOBRE O SOFTWARE.
            </div>

          </div>
          
        </div>
      </footer>
    </main>
  );
}

// HMR Force Reload
