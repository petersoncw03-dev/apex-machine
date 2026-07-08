'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useVip } from '@/hooks/useVip';
import {
  Radio, BrainCircuit, BarChart3, FlaskConical, Bot, Zap,
  Lock,
  LineChart, TrendingUp, Clock, ChevronLeft, ChevronRight, Menu,
  Database, Grid3X3, PlaySquare, Target, SlidersHorizontal,
  Pickaxe, LogOut, RefreshCcw, Home, BarChart2, Activity, Droplets, User
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Ao Vivo',
    items: [
      { href: '/painel-master', label: 'Painel Master', icon: <Home size={18} />, badge: 'Live' },
      { href: '/radar', label: 'Radar Avançado', icon: <Radio size={18} /> },
      // { href: '/radar-rec', label: 'Radar na REC', icon: <Zap size={18} />, badge: 'Novo' },
      // { href: '/radar-chuva', label: 'Radar de Chuva', icon: <Droplets size={18} />, badge: 'Novo' },
    ]
  },
  {
    title: 'Inteligência IA',
    items: [
      { href: '/analista', label: 'IA Analista', icon: <BrainCircuit size={18} /> },
      { href: '/max-soro', label: 'IA MaxSoro', icon: <Pickaxe size={18} />, badge: 'Novo' },
    ]
  },
  {
    title: 'Análise',
    items: [
      { href: '/laboratorio', label: 'Laboratório de Padrões', icon: <FlaskConical size={18} /> },
      { href: '/casa-exata', label: 'Casa Exata', icon: <TrendingUp size={18} /> },
      { href: '/dupla-exata', label: 'Dupla Exata', icon: <Target size={18} />, badge: 'Novo' },
      { href: '/analysis', label: 'Análise Avançada', icon: <Grid3X3 size={18} />, badge: 'Beta' },
    ]
  }
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const { isVip } = useVip();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Ícone SVG (Logo Apex Machine)
  const LogoIcon = () => (
    <div className="w-8 h-8 shrink-0 flex items-center justify-center">
      <svg viewBox="15 10 70 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M50 15 L80 65 L70 65 L50 30 L30 65 L20 65 Z" fill="#00ff41" />
        <path d="M45 45 L75 60 L45 75 L45 65 L60 60 L45 55 Z" fill="#e51e3e" />
      </svg>
    </div>
  );

  return (
    <>
      {/* Topbar Mobile */}
      <div className="md:hidden flex items-center justify-between h-16 w-full bg-[#0b0e14] border-b border-white/5 px-4 shrink-0">
        <div className="flex items-center gap-3">
          <LogoIcon />
          <span className="text-sm font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00ff41] to-emerald-400 leading-tight">
            Apex Machine
          </span>
        </div>
        <button onClick={() => setCollapsed(false)} className="text-white p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors">
          <Menu size={20} />
        </button>
      </div>

      {/* Placeholder para manter o espaço do menu na tela quando recolhido (desktop) */}
      <div className="w-16 shrink-0 h-screen hidden md:block" />

      {/* Backdrop (fundo escuro) que aparece quando o menu abre no Mobile */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'} `}
        onClick={() => setCollapsed(true)}
      />
      
      {/* Backdrop invisível no Desktop para fechar o menu ao clicar fora */}
      <div 
        className={`fixed inset-0 z-40 transition-opacity duration-300 hidden md:block ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
        onClick={() => setCollapsed(true)}
      />

      {/* Sidebar Fixa e Flutuante */}
      <aside className={`fixed top-0 left-0 h-[100dvh] z-50 flex flex-col bg-[#050507] border-r border-white/[0.05] transition-transform duration-300 ease-in-out shadow-2xl ${collapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-64'}`}>
        
        {/* Header / Logo */}
        <div 
          className={`flex items-center gap-3 px-4 h-20 border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.02] transition-colors ${collapsed ? 'justify-center' : ''}`}
          onClick={() => setCollapsed(!collapsed)}
        >
          <LogoIcon />
          {!collapsed && (
            <div className="flex flex-col justify-center">
              <span className="text-sm font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00ff41] to-emerald-400 leading-tight">
                Apex Machine
              </span>
              <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">
                Analytics
              </span>
            </div>
          )}
        </div>

        {/* Navegação principal */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 px-3 flex flex-col gap-1 custom-scrollbar">
          {sections.map((section, sIdx) => (
            <div key={section.title} className={sIdx !== 0 ? 'mt-4' : ''}>
              {!collapsed && (
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-600 px-3 mb-2">
                  {section.title}
                </div>
              )}
              {collapsed && sIdx !== 0 && <div className="border-t border-white/5 my-2 mx-2" />}
              
              <div className="flex flex-col gap-1">
                {section.items.map(item => {
                  const isActive = pathname === item.href;
                  const isRestricted = item.href !== '/painel-master';
                  const isLocked = isRestricted && !isVip;
                  
                  return (
                    <Link
                      key={item.href}
                      href={isLocked ? '#' : item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={(e) => {
                        if (isLocked) {
                           e.preventDefault();
                           alert('Ferramenta exclusiva VIP! Faça o upgrade do seu plano para acessar.');
                           router.push('/planos');
                           return;
                        }
                        if (!collapsed) setCollapsed(true);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
                        isActive
                          ? 'bg-[#181a20] text-[#00ff41]' 
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                      } ${collapsed ? 'justify-center' : ''} ${isLocked ? 'opacity-50 hover:opacity-80' : ''}`}
                    >
                      <span className={`shrink-0 transition-colors ${isActive ? 'text-[#00ff41]' : 'text-gray-400 group-hover:text-gray-300'}`}>
                        {item.icon}
                      </span>

                      {!collapsed && (
                        <span className={`text-[13px] font-medium truncate flex-1 flex items-center gap-2 ${isActive ? 'text-[#00ff41]' : ''}`}>
                          {item.label}
                          {isLocked && <Lock size={12} className="text-amber-500" />}
                        </span>
                      )}

                      {/* Bolinha indicador lateral */}
                      {!collapsed && isActive && !isLocked && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] shrink-0 shadow-[0_0_8px_rgba(0,255,65,0.8)]" />
                      )}

                      {/* Tooltip quando recolhido */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-[#12141c] border border-white/10 rounded-lg text-xs text-white font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl flex items-center gap-2">
                          {item.label}
                          {isLocked && <Lock size={10} className="text-amber-500" />}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer do Menu */}
        <div className="flex flex-col px-3 pb-4 pt-4 border-t border-white/[0.05] gap-2">
          {/* Versão */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-center'} py-2`}>
            {!collapsed ? (
              <span className="text-[11px] font-bold text-gray-600 tracking-wider flex items-center gap-2 cursor-pointer hover:text-gray-400 transition-colors">
                Versão 1.0.0 <RefreshCcw size={12} />
              </span>
            ) : (
              <span className="text-[10px] font-bold text-gray-600 flex items-center gap-1 cursor-pointer hover:text-gray-400 transition-colors" title="Versão 1.0.0">
                V1 <RefreshCcw size={10} />
              </span>
            )}
          </div>

          <div className="h-[1px] w-full bg-white/[0.05] my-1"></div>

          {/* Minha Conta */}
          <Link
            href="/minha-conta"
            title={collapsed ? 'Minha Conta' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full ${
              pathname === '/minha-conta'
                ? 'bg-[#181a20] text-[#00ff41]' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
            } ${collapsed ? 'justify-center' : ''}`}
            onClick={() => { if (!collapsed) setCollapsed(true); }}
          >
            <User size={18} className={pathname === '/minha-conta' ? 'text-[#00ff41]' : 'text-gray-400'} />
            {!collapsed && <span className={`text-[13px] font-medium ${pathname === '/minha-conta' ? 'text-[#00ff41]' : ''}`}>Minha Conta</span>}
          </Link>

          {/* Botão Sair */}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sair da conta' : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} />
            {!collapsed && <span className="text-[13px] font-medium">Sair</span>}
          </button>

          {/* Botão Recolher/Abrir */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mt-1 ${collapsed ? 'justify-center text-gray-500 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.03]'}`}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="text-[13px] font-medium">Recolher</span>}
          </button>
        </div>

      </aside>
    </>
  );
}
