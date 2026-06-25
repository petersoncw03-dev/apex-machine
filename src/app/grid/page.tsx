'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface RowData {
  id?: string;
  color: string;
  roll: string | number;
  timestamp: string; // HH:MM:SS
}

interface MinuteColumn {
  slot1: RowData | null; // 00-29s
  slot2: RowData | null; // 30-59s
}

interface TenMinuteBlock {
  key: string; // ex: "13:30"
  timestampMs: number; // For sorting
  columns: MinuteColumn[]; // Array of 10 (0 to 9)
  isNewDay?: boolean;
}

const RED = '#f12c4c';
const BLACK = '#262831';
const WHITE = '#ffffff';

export default function GridPage() {
  const [blocks, setBlocks] = useState<TenMinuteBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`/api/results/period?hours=60`);
      if (!res.ok) throw new Error('Falha');
      const json = await res.json();
      
      if (json.data) {
        const normalized = json.data.map((r: any) => ({ ...r, color: r.color?.toString().charAt(0).toUpperCase() + r.color?.toString().slice(1).toLowerCase(), roll: r.roll?.toString() }));
        processGridData(normalized);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const processGridData = (data: RowData[]) => {
    const blockMap = new Map<string, TenMinuteBlock & { isNewDay?: boolean }>();

    let currentDay = 0;
    let prevHour = -1;

    data.forEach(item => {
      if (!item.timestamp) return;
      const d = new Date(item.timestamp);
      if (isNaN(d.getTime())) return;
      
      const hour = d.getHours();
      const minute = d.getMinutes();
      const second = d.getSeconds();

      const hStr = hour.toString().padStart(2, '0');

      // Detect day crossing
      if (prevHour !== -1 && hour < prevHour - 12) {
        currentDay++;
      }
      prevHour = hour;

      const baseMinute = Math.floor(minute / 10) * 10;
      const key = `D${currentDay}-${hStr}:${baseMinute.toString().padStart(2, '0')}`;
      
      if (!blockMap.has(key)) {
        const emptyCols: MinuteColumn[] = Array(10).fill(null).map(() => ({ slot1: null, slot2: null }));
        
        blockMap.set(key, {
          key,
          timestampMs: 0,
          columns: emptyCols,
          isNewDay: (hour === 0 && baseMinute === 0 && currentDay > 0)
        });
      }

      const block = blockMap.get(key)!;
      const colIndex = minute % 10;
      
      if (second < 30) {
        block.columns[colIndex].slot1 = item;
      } else {
        block.columns[colIndex].slot2 = item;
      }
    });

    // Reverse the blocks to show newest (bottom of the sheet) on top
    const sortedBlocks = Array.from(blockMap.values()).reverse();
    setBlocks(sortedBlocks);
  };

  const getSlotColor = (colorStr: string) => {
    if (!colorStr) return 'transparent';
    if (colorStr.includes('Vermelho') || colorStr.includes('1')) return RED;
    if (colorStr.includes('Preto') || colorStr.includes('2')) return BLACK;
    if (colorStr.includes('Branco') || colorStr.includes('0')) return WHITE;
    return 'transparent';
  };

  const renderSlot = (slot: RowData | null) => {
    if (!slot) {
      return (
        <div className="w-8 h-8 md:w-10 md:h-10 border border-white/20 rounded-sm flex items-center justify-center m-0.5">
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-white/10"></div>
        </div>
      );
    }

    const bgColor = getSlotColor(slot.color);
    const isWhite = bgColor === WHITE;

    return (
      <div 
        className="w-8 h-8 md:w-10 md:h-10 rounded-sm flex items-center justify-center m-0.5"
        style={{ backgroundColor: isWhite ? '#1e1e1e' : bgColor, border: isWhite ? '1px solid #fff' : 'none' }}
      >
        <div 
          className="w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border-[2px]"
          style={{ 
            backgroundColor: isWhite ? WHITE : 'transparent',
            borderColor: isWhite ? 'transparent' : 'rgba(255,255,255,0.9)',
          }}
        >
          {isWhite ? (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#f12c4c]">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
          ) : (
            <span className="text-white font-bold text-xs md:text-sm">{slot.roll}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-full overflow-x-auto">
      {loading && blocks.length === 0 ? (
        <div className="flex justify-center mt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#e51e3e]"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-max mx-auto bg-[#0a0a0f] p-4 rounded-lg">
          {/* Main Headers 00 to 09 */}
          <div className="flex bg-gradient-to-r from-blue-900/40 to-indigo-900/30 border-b border-white/10 mb-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-[72px] md:w-[88px] flex-none text-center font-black text-white py-2 border-r border-white/5 last:border-0 text-[10px] uppercase tracking-widest">
                Minuto {i}
              </div>
            ))}
          </div>

          {/* Rows */}
          {blocks.map((block) => {
            const timePart = block.key.split('-')[1]; // Removes D0-, D1-
            const [hourStr, minuteStr] = timePart.split(':');
            
            return (
              <div key={block.key}>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex"
                >
                {block.columns.map((col, i) => {
                  const currentMin = parseInt(minuteStr) + i;
                  const timeLabel = `${hourStr}:${currentMin.toString().padStart(2, '0')}`;
                  
                  return (
                    <div key={i} className="flex flex-col items-center border-r border-white/5 last:border-0 bg-[#12141c]">
                      {/* Slots Container */}
                      <div className="flex p-0.5">
                        {renderSlot(col.slot1)}
                        {renderSlot(col.slot2)}
                      </div>
                      {/* Timestamp below the slots */}
                      <div className="text-[10px] md:text-xs text-gray-400 py-1 font-mono tracking-tighter">
                        {timeLabel}
                      </div>
                    </div>
                  );
                })}
                </motion.div>

                {/* Day Separator */}
                {block.isNewDay && (
                  <div className="flex items-center justify-center py-4 my-2 opacity-50 relative">
                    <div className="w-full h-[1px] bg-white/20 absolute"></div>
                    <span className="bg-[#0a0a0f] px-4 text-xs text-white/50 relative z-10 uppercase tracking-widest font-bold">
                      Novo Dia
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
