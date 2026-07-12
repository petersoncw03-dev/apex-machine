import { useMemo, useState, useEffect } from 'react';
import { calculateCoresEngine, RollData } from './engine/engines/coresEngine';

export interface MestreCoresState {
    status: 'standby' | 'active' | 'win' | 'loss';
    step: number;
    level: number;
    targetColor: 'R' | 'B' | null;
    stones: number[];
    scheduledMinute: number | null; // Se for agendado
}

export function useMestreCores(globalData: RollData[], lookbackHours: number = 3) {
    const [mestreState, setMestreState] = useState<MestreCoresState>({
        status: 'standby',
        step: 0,
        level: 0,
        targetColor: null,
        stones: [],
        scheduledMinute: null
    });
    
    const [placarDiario, setPlacarDiario] = useState({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: new Date().getDate() });

    const engineState = useMemo(() => {
        return calculateCoresEngine(globalData, lookbackHours);
    }, [globalData, lookbackHours]);

    useEffect(() => {
        if (!globalData || globalData.length < 50) return;
        const newRoll = globalData[globalData.length - 1];
        const currentMin = new Date(newRoll.timestamp).getMinutes();
        const isRed = newRoll.roll >= 1 && newRoll.roll <= 7;
        const isBlack = newRoll.roll >= 8 && newRoll.roll <= 14;

        // Placar diário reset
        const today = new Date().getDate();
        if (placarDiario.lastResetDate !== today) {
            setPlacarDiario({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: today });
        }

        setMestreState(prevState => {
            let nextState = { ...prevState };

            if (prevState.status === 'active') {
                // Checar se a aposta é imediata ou se está agendada pro futuro
                if (prevState.scheduledMinute !== null) {
                    if (prevState.scheduledMinute !== currentMin && prevState.stones.length === 0) {
                        // Verifica se o minuto já passou para não travar o robô
                        let isPast = false;
                        if (currentMin > prevState.scheduledMinute && (currentMin - prevState.scheduledMinute) < 5) isPast = true;
                        if (prevState.scheduledMinute >= 55 && currentMin < 5) isPast = true;
                        
                        if (isPast) {
                            return { status: 'standby', step: 0, level: 0, targetColor: null, stones: [], scheduledMinute: null };
                        }
                        
                        return nextState; 
                    } else {
                        // O minuto exato chegou, vamos limpar o agendamento para liberar as próximas pedras (Gales)
                        nextState.scheduledMinute = null;
                    }
                }

                // Agora estamos no minuto exato ou é uma entrada imediata
                nextState.stones = [...prevState.stones, newRoll.roll];
                
                const won = (prevState.targetColor === 'R' && isRed) || (prevState.targetColor === 'B' && isBlack);
                
                if (won) {
                    nextState.status = 'win';
                    setPlacarDiario(p => ({ ...p, wins: p.wins + 1, sa: 0 }));
                } else {
                    if (prevState.step < 2) { // 2 Entradas (G1)
                        nextState.step = prevState.step + 1;
                    } else {
                        nextState.status = 'loss';
                        setPlacarDiario(p => ({ ...p, losses: p.losses + 1, sa: p.sa + 1, sm: Math.max(p.sm, p.sa + 1) }));
                    }
                }
            } else {
                // Standby: Verificar novos gatilhos!
                let triggerR = 0;
                let triggerB = 0;
                let scheduleR: number | null = null;
                let scheduleB: number | null = null;

                // 1. Padrões Ao Vivo (Imediato)
                if (engineState.livePatterns.avgRedPatWr >= 80) triggerR++;
                if (engineState.livePatterns.avgBlackPatWr >= 80) triggerB++;

                // 2. Minutos Agendados (Avisa com 1 a 2 min de antecedência)
                const nextMin1 = (currentMin + 1) % 60;
                const nextMin2 = (currentMin + 2) % 60;
                
                const scheds = engineState.scheduledMinutes.filter(s => s.minute === nextMin1 || s.minute === nextMin2);
                for (const s of scheds) {
                    if (s.target === 'R') { triggerR++; scheduleR = s.minute; }
                    if (s.target === 'B') { triggerB++; scheduleB = s.minute; }
                }

                // 3. Matriz (Colunas) - Minutos terminados em X
                // Se a próxima coluna for boa
                const colTarget = (currentMin + 1) % 10;
                const colStat = engineState.matrixCols[colTarget];
                if (colStat.total >= 3) {
                    const cRwr = (colStat.red / colStat.total) * 100;
                    const cBwr = (colStat.black / colStat.total) * 100;
                    if (cRwr >= 80) { triggerR++; scheduleR = nextMin1; }
                    if (cBwr >= 80) { triggerB++; scheduleB = nextMin1; }
                }

                if (triggerR > 0 || triggerB > 0) {
                    // Resolução de Conflitos Pesada
                    if (triggerR > triggerB) {
                        nextState = { status: 'active', step: 1, level: triggerR, targetColor: 'R', stones: [], scheduledMinute: scheduleR };
                    } else if (triggerB > triggerR) {
                        nextState = { status: 'active', step: 1, level: triggerB, targetColor: 'B', stones: [], scheduledMinute: scheduleB };
                    } else {
                        // Conflito (Empate)! Anula.
                        // Fica em standby
                    }
                }
            }
            return nextState;
        });
    }, [globalData]); // Executa sempre que chegar nova pedra

    // Timeout para limpar win/loss
    useEffect(() => {
        if (mestreState.status === 'win' || mestreState.status === 'loss') {
            const timer = setTimeout(() => {
                setMestreState({ status: 'standby', step: 0, level: 0, targetColor: null, stones: [], scheduledMinute: null });
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [mestreState.status]);

    return {
        mestreState,
        placarDiario,
        engineState
    };
}
