import { useMemo, useState, useEffect, useRef } from 'react';
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

    const lastRollRef = useRef<string | null>(null);

    useEffect(() => {
        if (!globalData || globalData.length < 50) return;
        const newRoll = globalData[globalData.length - 1];
        
        if (lastRollRef.current === (newRoll.id || newRoll.timestamp)) return;
        lastRollRef.current = newRoll.id || newRoll.timestamp;

        const currentMin = new Date(newRoll.timestamp).getMinutes();
        const isRed = newRoll.roll >= 1 && newRoll.roll <= 7;
        const isBlack = newRoll.roll >= 8 && newRoll.roll <= 14;

        // Placar diário reset (Desativado a pedido do usuário)
        // const today = new Date().getDate();
        // if (placarDiario.lastResetDate !== today) {
        //     setPlacarDiario({ wins: 0, losses: 0, sa: 0, sm: 0, lastResetDate: today });
        // }

        let nextState = { ...mestreState };

        if (mestreState.status === 'active') {
            // Checar se a aposta é imediata ou se está agendada pro futuro
            if (mestreState.scheduledMinute !== null) {
                if (mestreState.scheduledMinute !== currentMin && mestreState.stones.length === 0) {
                    // Verifica se o minuto já passou para não travar o robô
                    let isPast = false;
                    if (currentMin > mestreState.scheduledMinute && (currentMin - mestreState.scheduledMinute) < 5) isPast = true;
                    if (mestreState.scheduledMinute >= 55 && currentMin < 5) isPast = true;
                    
                    if (isPast) {
                        setMestreState({ status: 'standby', step: 0, level: 0, targetColor: null, stones: [], scheduledMinute: null });
                        return;
                    }
                    
                    return; 
                } else {
                    // O minuto exato chegou, vamos limpar o agendamento para liberar as próximas pedras (Gales)
                    nextState.scheduledMinute = null;
                }
            }

            // Agora estamos no minuto exato ou é uma entrada imediata
            nextState.stones = [...mestreState.stones, newRoll.roll];
            
            const won = (mestreState.targetColor === 'R' && isRed) || (mestreState.targetColor === 'B' && isBlack);
            
            if (won) {
                nextState.status = 'win';
                setPlacarDiario({ ...placarDiario, wins: placarDiario.wins + 1, sa: 0 });
            } else {
                if (mestreState.step < 2) { // 2 Entradas (G1)
                    nextState.step = mestreState.step + 1;
                } else {
                    nextState.status = 'loss';
                    setPlacarDiario({ ...placarDiario, losses: placarDiario.losses + 1, sa: placarDiario.sa + 1, sm: Math.max(placarDiario.sm, placarDiario.sa + 1) });
                }
            }
        } else {
            // Standby: Verificar novos gatilhos!
            let triggerR = 0;
            let triggerB = 0;
            let scheduleR: null | number = null;
            let scheduleB: null | number = null;

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
        setMestreState(nextState);
    }, [globalData, mestreState, engineState, placarDiario]); // Executa sempre que chegar nova pedra ou state mudar

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
