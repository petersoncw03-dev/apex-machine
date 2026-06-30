'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Play, Target, BrainCircuit, Activity, Zap, Cpu, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToPresentation = () => {
    const el = document.getElementById('presentation');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#00ff41]/30 relative overflow-hidden">
      {/* Luzes de fundo globais */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#00ff41]/[0.05] blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-[#e51e3e]/[0.02] blur-[150px] rounded-full pointer-events-none z-0"></div>

      {/* HEADER FIXO */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#050505]/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8">
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <path d="M50 15 L80 65 L70 65 L50 30 L30 65 L20 65 Z" fill="#00ff41" />
                <path d="M45 45 L75 60 L45 75 L45 65 L60 60 L45 55 Z" fill="#e51e3e" />
              </svg>
            </div>
            <h1 className="text-xl font-mono tracking-[0.2em] font-light flex gap-2">
              <span className="text-[#00ff41]">APEX</span>
              <span className="text-[#e51e3e]">MACHINE</span>
            </h1>
          </div>
          <Link href="/login" className="px-5 py-2 text-xs font-mono font-bold tracking-widest text-white/70 hover:text-white uppercase transition-colors">
            Login
          </Link>
        </div>
      </header>

      {/* HERO SECTION (ATTENTION) */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 z-10">
        <div className="text-center max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 fill-mode-both">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest text-[#00ff41] mb-8">
            <Cpu size={14} />
            <span>O FUTURO DA ANÁLISE PREDITIVA</span>
          </div>
          
          <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            Domine o mercado com <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff41] to-emerald-500 drop-shadow-[0_0_30px_rgba(0,255,65,0.4)]">Inteligência Artificial</span>
          </h2>
          
          <p className="text-lg md:text-xl text-white/50 font-medium max-w-2xl mx-auto mb-12">
            O ecossistema definitivo para análises precisas, rastreamento de padrões em tempo real e algoritmos que trabalham enquanto você dorme.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
            <button 
              onClick={scrollToPresentation}
              className="w-full px-8 py-4 bg-[#00ff41] hover:bg-emerald-400 text-black font-mono font-black text-sm uppercase tracking-widest rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(0,255,65,0.4)] flex items-center justify-center gap-2"
            >
              Quero conhecer o Apex
              <ChevronDown size={18} />
            </button>
            <Link 
              href="/login"
              className="w-full px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-mono font-bold text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Já sou cliente
            </Link>
          </div>
        </div>
      </section>

      {/* VIDEO / INTEREST SECTION */}
      <section id="presentation" className="relative py-24 px-6 z-10 bg-black/40 border-y border-white/5 backdrop-blur-md">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-5xl font-black mb-4">Veja o Apex Machine em Ação</h3>
            <p className="text-white/50 text-lg">Descubra exatamente como nossa IA encontra as melhores oportunidades do mercado, segundo a segundo.</p>
          </div>

          {/* VSL (Video Sales Letter) Placeholder */}
          <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-black/60 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden group cursor-pointer">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-[#00ff41]/20 border border-[#00ff41]/50 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-[#00ff41]/30 transition-all duration-300">
                <Play fill="#00ff41" size={32} className="text-[#00ff41] ml-2" />
              </div>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              <div className="text-sm font-mono tracking-widest text-[#00ff41] mb-2 uppercase">Apresentação Oficial</div>
              <div className="text-xl font-bold">Como funciona a engrenagem por trás do Apex</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES / DESIRE SECTION */}
      <section className="relative py-32 px-6 z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl md:text-5xl font-black mb-4">Tecnologia Institucional</h3>
            <p className="text-white/50 text-lg">Tudo o que você precisa para sair do escuro e operar com visão raio-x.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white/[0.02] border border-white/5 hover:border-[#00ff41]/30 rounded-2xl p-8 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-[#00ff41]/10 flex items-center justify-center mb-6 group-hover:bg-[#00ff41]/20 transition-colors">
                <Activity className="text-[#00ff41]" size={28} />
              </div>
              <h4 className="text-xl font-bold mb-3">Scanner BCO em Tempo Real</h4>
              <p className="text-white/50 leading-relaxed">Mapeie 100% das pedras com nosso radar avançado. Histórico infinito sem travamentos, com alertas sonoros nativos e painéis de dominância.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/[0.02] border border-white/5 hover:border-[#00ff41]/30 rounded-2xl p-8 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-[#00ff41]/10 flex items-center justify-center mb-6 group-hover:bg-[#00ff41]/20 transition-colors">
                <BrainCircuit className="text-[#00ff41]" size={28} />
              </div>
              <h4 className="text-xl font-bold mb-3">Analista IA Avançado</h4>
              <p className="text-white/50 leading-relaxed">Deixe que nossa inteligência identifique as zonas de calor, máximas do dia e probabilidade estatística exata antes de você fazer qualquer movimento.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/[0.02] border border-white/5 hover:border-[#00ff41]/30 rounded-2xl p-8 transition-colors group">
              <div className="w-14 h-14 rounded-xl bg-[#00ff41]/10 flex items-center justify-center mb-6 group-hover:bg-[#00ff41]/20 transition-colors">
                <Target className="text-[#00ff41]" size={28} />
              </div>
              <h4 className="text-xl font-bold mb-3">Simuladores Profissionais</h4>
              <p className="text-white/50 leading-relaxed">Crie, teste e valide estratégias nos Simuladores de Casa Exata e Dupla Exata. Descubra padrões ocultos sem arriscar seu capital.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / ACTION SECTION */}
      <section className="relative py-32 px-6 z-10 bg-gradient-to-b from-transparent to-[#00ff41]/5 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-4xl md:text-6xl font-black mb-6">Pronto para a evolução?</h3>
          <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto">Junte-se à elite que utiliza o Apex Machine para dominar as probabilidades. Chega de apostas cegas.</p>
          
          <button className="px-10 py-5 bg-[#00ff41] hover:bg-emerald-400 text-black font-mono font-black text-lg uppercase tracking-widest rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(0,255,65,0.4)] flex items-center justify-center gap-3 mx-auto">
            <ShieldCheck size={24} />
            Assinar Agora
          </button>
          
          <div className="mt-8 flex items-center justify-center gap-4 text-xs font-mono text-white/30 uppercase tracking-widest">
            <span>Acesso Imediato</span>
            <span>•</span>
            <span>Suporte 24/7</span>
            <span>•</span>
            <span>Garantia de 7 dias</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-white/5 bg-black text-center text-xs font-mono text-white/30 tracking-widest uppercase relative z-10">
        <p>© {new Date().getFullYear()} APEX MACHINE. TODOS OS DIREITOS RESERVADOS.</p>
      </footer>
    </main>
  );
}
