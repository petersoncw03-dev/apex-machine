'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GlobalStoneIcon } from '@/components/GlobalStoneIcon';

interface RollData {
  roll: number | string;
  timestamp: string | Date;
  id?: string;
  color?: string;
}

interface LiveHistoryCardProps {
  data: RollData[];
  maxItems?: number;
  title?: string;
}

function RealTimeClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return <span>{time}</span>;
}

export function LiveHistoryCard({ data, maxItems = 40 }: LiveHistoryCardProps) {
  const tickerRef = useRef<HTMLDivElement>(null);
  const isDraggingTicker = useRef(false);
  const startXTicker = useRef(0);
  const scrollLeftTicker = useRef(0);

  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;
    const onMouseDown = (e: MouseEvent) => {
      isDraggingTicker.current = true;
      startXTicker.current = e.pageX - el.offsetLeft;
      scrollLeftTicker.current = el.scrollLeft;
      el.style.cursor = 'grabbing';
    };
    const onMouseLeave = () => {
      isDraggingTicker.current = false;
      el.style.cursor = 'grab';
    };
    const onMouseUp = () => {
      isDraggingTicker.current = false;
      el.style.cursor = 'grab';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingTicker.current) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startXTicker.current) * 2;
      el.scrollLeft = scrollLeftTicker.current - walk;
    };
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const displayData = data.slice(-maxItems);

  return (
    <div className="bg-[#0f141e]/80 backdrop-blur-xl border border-[#00c83a]/25 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 relative flex flex-col shrink-0">
      <div className="px-5 py-3 bg-gradient-to-b from-[#00c83a]/10 to-transparent border-b border-[#00c83a]/20 flex justify-between items-center border-t-[3px] border-t-[#00c83a] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
               </span>
               <span className="text-[14px] font-black tracking-wide text-white">Tempo Real</span>
            </div>
         </div>
         
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-green-400 text-[12px] font-bold font-mono bg-green-400/10 px-2 py-1 rounded-md border border-green-400/20">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
               <RealTimeClock />
            </div>
         </div>
      </div>
      <div 
        ref={tickerRef} 
        className="w-full flex flex-row-reverse gap-3 overflow-x-auto justify-start items-center p-6 bg-black/40 cursor-grab custom-scrollbar"
        style={{ scrollBehavior: 'smooth' }}
      >
         {[...displayData].reverse().map((roll) => {
            const n = typeof roll.roll === 'string' ? parseInt(roll.roll) : roll.roll;
            if (isNaN(n)) return null;
            const time = new Date(roll.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return (
               <div key={roll.id || roll.timestamp.toString()} className="flex flex-col items-center p-1.5 border border-[#00c83a]/10 bg-[#0b0e14]/70 rounded-xl shrink-0 w-[60px] shadow-sm hover:bg-[#00c83a]/20 transition-all hover:-translate-y-1">
                 <GlobalStoneIcon n={n} size="md" />
                 <span className="text-[10px] text-gray-500 font-bold mt-2 tracking-widest">{time}</span>
               </div>
            );
         })}
      </div>
    </div>
  );
}
