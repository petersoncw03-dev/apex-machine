'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

export function LiveHistoryCard({ data, maxItems = 40 }: LiveHistoryCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the right whenever data changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth'
      });
    }
  }, [data]);

  const displayData = data.slice(-maxItems);

  return (
    <div className="bg-[#0a0a0f] border border-slate-700/50 rounded-xl overflow-hidden shadow-xl flex flex-col shrink-0">
      <div className="px-5 py-3 border-b border-slate-700/50 bg-slate-900/50 flex items-center">
        <span className="text-[11px] font-black uppercase tracking-widest text-white">Histórico Ao Vivo</span>
      </div>
      <div 
        ref={scrollRef} 
        className="w-full flex gap-2 overflow-x-auto custom-scrollbar items-center p-3 bg-black/20"
      >
        <AnimatePresence initial={false}>
          {displayData.map((roll, i) => {
            const n = typeof roll.roll === 'string' ? parseInt(roll.roll) : roll.roll;
            if (isNaN(n)) return null;
            
            const time = new Date(roll.timestamp).toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            });

            return (
              <motion.div 
                key={roll.id || `${time}-${i}`}
                initial={{ opacity: 0, x: 50, scale: 0.5 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex flex-col items-center p-1 border border-white/10 bg-[#0a0a0f] rounded-md shrink-0 w-[56px] shadow-sm hover:border-white/20 transition-all"
              >
                <GlobalStoneIcon n={n} size="md" />
                <span className="text-[9px] text-gray-400 font-bold mt-1 tracking-widest">{time}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
