import { FlaskConical, Calculator, Activity, Hash, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SandboxHub() {
  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8 bg-[#030303]">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 flex items-center gap-3">
               <FlaskConical className="text-purple-500" size={32} />
               Sandbox Mestre
            </h1>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">
                Laboratório de Calibração Temporal - Backtests Isolados
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/sandbox/soma2pedras" className="group bg-[#0a0a0f] border border-white/5 hover:border-purple-500/50 rounded-xl p-6 flex flex-col gap-4 transition-all hover:bg-[#12121c] shadow-lg hover:shadow-purple-900/20">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                   <Calculator className="text-purple-400" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-1">Soma de 2 Pedras</h2>
                   <p className="text-xs text-gray-500 font-medium">Máquina de Tempo: Analise a assertividade da soma das últimas pedras para prever alvos (brancos/cores) com filtros de SA e SM.</p>
                </div>
                <div className="mt-auto pt-4 flex items-center text-purple-400 text-xs font-bold uppercase tracking-widest group-hover:text-purple-300">
                    Acessar Simulador <ArrowRight size={14} className="ml-2" />
                </div>
            </Link>

            <Link href="/sandbox/painel-minutos" className="group bg-[#0a0a0f] border border-white/5 hover:border-blue-500/50 rounded-xl p-6 flex flex-col gap-4 transition-all hover:bg-[#12121c] shadow-lg hover:shadow-blue-900/20">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                   <Activity className="text-blue-400" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-1">Painel de Minutos</h2>
                   <p className="text-xs text-gray-500 font-medium">Máquina de Tempo: Analise a assertividade por colunas (00-29s / 30-59s) dentro de cada minuto do relógio para entradas precisas.</p>
                </div>
                <div className="mt-auto pt-4 flex items-center text-blue-400 text-xs font-bold uppercase tracking-widest group-hover:text-blue-300">
                    Acessar Simulador <ArrowRight size={14} className="ml-2" />
                </div>
            </Link>

            <Link href="/sandbox/casa-exata-ia" className="group bg-[#0a0a0f] border border-white/5 hover:border-green-500/50 rounded-xl p-6 flex flex-col gap-4 transition-all hover:bg-[#12121c] shadow-lg hover:shadow-green-900/20">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform">
                   <FlaskConical className="text-green-400" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-1">IA Casa Exata</h2>
                   <p className="text-xs text-gray-500 font-medium">Motor IA Genético: Automatiza a busca pelas melhores configurações de repetição e limites para alvos simples.</p>
                </div>
                <div className="mt-auto pt-4 flex items-center text-green-400 text-xs font-bold uppercase tracking-widest group-hover:text-green-300">
                    Acessar IA <ArrowRight size={14} className="ml-2" />
                </div>
            </Link>

            <Link href="/sandbox/dupla-exata-ia" className="group bg-[#0a0a0f] border border-white/5 hover:border-pink-500/50 rounded-xl p-6 flex flex-col gap-4 transition-all hover:bg-[#12121c] shadow-lg hover:shadow-pink-900/20">
                <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center border border-pink-500/20 group-hover:scale-110 transition-transform">
                   <FlaskConical className="text-pink-400" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-1">IA Dupla Exata</h2>
                   <p className="text-xs text-gray-500 font-medium">Motor IA Genético: Automatiza a varredura das melhores configurações em combinações complexas de matriz 15x15.</p>
                </div>
                <div className="mt-auto pt-4 flex items-center text-pink-400 text-xs font-bold uppercase tracking-widest group-hover:text-pink-300">
                    Acessar IA <ArrowRight size={14} className="ml-2" />
                </div>
            </Link>

            <div className="bg-[#0a0a0f] border border-white/5 opacity-50 rounded-xl p-6 flex flex-col gap-4 cursor-not-allowed">
                <div className="w-12 h-12 bg-gray-500/10 rounded-lg flex items-center justify-center border border-gray-500/20">
                   <Hash className="text-gray-400" />
                </div>
                <div>
                   <h2 className="text-xl font-bold text-gray-400 uppercase tracking-wider mb-1">Padrões /Analista</h2>
                   <p className="text-xs text-gray-600 font-medium">Em breve. Backtest de blocos numéricos e puxadas de branco nos últimos dias.</p>
                </div>
            </div>
        </div>
    </main>
  );
}
