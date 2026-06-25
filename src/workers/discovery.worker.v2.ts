export interface Roll { id?: string; color: string; roll: string | number; }
export interface PatternElement { t: 'c' | 'n'; v: string | number; }
export interface DiscoveredPattern { id: string; lossMode: string; entries: number; type: string; elements: PatternElement[]; winRate: string; count: number; triggers: number; sa: number; sm: number; pa: number; pm: number; activeNow: boolean; target?: string; currentStep?: number; }

const getCol = (r: Roll) => {
  if (!r) return 'B';
  const n = parseInt(r.roll as string);
  if (r.color.includes('Vermelho') || (n >= 1 && n <= 7)) return 'V';
  if (r.color.includes('Preto') || (n >= 8 && n <= 14)) return 'P';
  return 'B';
};

const isColorMatch = (rollCol: string, elVal: string) => {
    return rollCol === elVal;
};

const evaluateHit = (roll: Roll, target: string, coverWhite: boolean = true) => {
  if (!roll) return false;
  const t = target.toUpperCase();
  if (t === 'BCO' || t === 'BRANCO') return getCol(roll) === 'B';
  if (t === 'V' || t === 'VERMELHO') return getCol(roll) === 'V' || (coverWhite && getCol(roll) === 'B');
  if (t === 'P' || t === 'PRETO') return getCol(roll) === 'P' || (coverWhite && getCol(roll) === 'B');
  return false;
};

const runFullDiscoveryCiclo = (config: any, currentData: Roll[], isAuto: boolean, oldActiveIds: Set<string> = new Set()) => {
    if (!currentData || currentData.length < 10) return;
    
    const execute = () => {
      const { periodHours, patternType, entriesRange, targetFocus, minTriggers, minWinRate, maxSa, minSaFilter, sizeRange } = config;
      const [minEntries, maxEntries] = entriesRange || [1, 5];
      const history = currentData.slice(-periodHours * 120);
      const patternState: Record<string, any> = {};
      const typesToTest = patternType === 'TODOS' ? ['ONLY_COLORS', 'ONLY_NUMBERS', 'COLORS_1_NUM', 'COLORS_2_NUM', '1_NUM_COLORS', '2_NUM_COLORS'] : [patternType];
      const discoveryTargets = targetFocus === 'Ambos' ? ['Vermelho', 'Preto'] : [targetFocus];

      for (const target of discoveryTargets) {
        for (const type of typesToTest) {
          let sizes: number[] = [];
          if (sizeRange && sizeRange.length === 2) {
             for (let s = sizeRange[0]; s <= sizeRange[1]; s++) sizes.push(s);
          } else {
             sizes = [3];
          }

          for (const totalLen of sizes) {
            for (let i = 0; i <= history.length - totalLen; i++) {
              const elements: PatternElement[] = [];
              if (type === 'ONLY_COLORS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === 'ONLY_NUMBERS') {
                for(let p=0; p<totalLen; p++) elements.push({t:'n', v: history[i+p].roll});
              } else if (type === 'COLORS_1_NUM') {
                for(let p=0; p<totalLen-1; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === 'COLORS_2_NUM') {
                for(let p=0; p<totalLen-2; p++) elements.push({t:'c', v: getCol(history[i+p])});
                elements.push({t:'n', v: history[i+totalLen-2].roll});
                elements.push({t:'n', v: history[i+totalLen-1].roll});
              } else if (type === '1_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                for(let p=1; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              } else if (type === '2_NUM_COLORS') {
                elements.push({t:'n', v: history[i].roll});
                elements.push({t:'n', v: history[i+1].roll});
                for(let p=2; p<totalLen; p++) elements.push({t:'c', v: getCol(history[i+p])});
              }

              if (elements.length === 0) continue;
              if (patternType !== 'ONLY_NUMBERS' && elements.some(e => e.t === 'n' && e.v === '0')) continue;

              const exactKeyFragment = elements.map(e => e.t + e.v).join('|');
              const key = target + ':' + type + ':' + exactKeyFragment;
              
              if (!patternState[key]) {
                  patternState[key] = { elements, type, target, entriesData: {} };
                  for (let e = minEntries; e <= maxEntries; e++) {
                      patternState[key].entriesData[e] = { triggers: 0, wins: 0, sm: 0, currentSa: 0, maxSa: 0, currentPa: 0, maxPa: 0 };
                  }
              }
              
              for (let e = minEntries; e <= maxEntries; e++) {
                  const keyE = key + '_' + e;
                  if (i < (patternState[key].entriesData[e].nextValidIndex || 0)) continue;
                  patternState[key].entriesData[e].triggers++;
                  
                  let hit = false;
                  let aborted = false;
                  let incomplete = false;
                  let stepsTaken = 0;
                  
                  for (let w = 1; w <= e; w++) {
                    stepsTaken++;
                    const nxt = history[i + totalLen - 1 + w];
                    if (!nxt) { incomplete = true; break; }
                    if (evaluateHit(nxt, target, config.coverWhite !== false)) { 
                        hit = true; 
                        break; 
                    }
                  }
                  
                  if (incomplete && !hit && !aborted) {
                    // pendente
                  } else if (hit) {
                    patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    patternState[key].entriesData[e].wins++;
                    patternState[key].entriesData[e].currentSa = 0; 
                    patternState[key].entriesData[e].currentPa++; 
                    if (patternState[key].entriesData[e].currentPa > patternState[key].entriesData[e].maxPa) patternState[key].entriesData[e].maxPa = patternState[key].entriesData[e].currentPa;
                  } else {
                    patternState[key].entriesData[e].nextValidIndex = config.continuousRead ? i + 1 : i + totalLen - 1 + e;
                    patternState[key].entriesData[e].currentSa++; 
                    patternState[key].entriesData[e].currentPa = 0;
                    if (patternState[key].entriesData[e].currentSa > patternState[key].entriesData[e].maxSa) {
                        patternState[key].entriesData[e].maxSa = patternState[key].entriesData[e].currentSa;
                    }
                  }
              }
            }
          }
        }
      }
      
      const results: DiscoveredPattern[] = [];
      Object.entries(patternState).forEach(([k, v]) => {
         for (let e = minEntries; e <= maxEntries; e++) {
             const eState = v.entriesData[e];
             const wr = ((eState.wins / (eState.triggers || 1)) * 100).toFixed(1);
             if (eState.triggers >= minTriggers && parseFloat(wr) >= minWinRate && eState.maxSa <= maxSa && eState.currentSa >= minSaFilter && eState.currentPa >= (config.minPaFilter || 0)) {
                results.push({
                   id: k + '|ENT_' + e, lossMode: 'CICLO', entries: e,
                   type: v.type, elements: v.elements, winRate: wr, count: eState.wins,
                   triggers: eState.triggers, sa: eState.currentSa, sm: eState.maxSa, pa: eState.currentPa, pm: eState.maxPa, activeNow: false, target: v.target
                });
             }
         }
      });
      
      let finalResults = results.map(pat => {
         let currentStep = 0;
         let activeNow = false;
         for (let step = 0; step < (pat.entries || maxEntries); step++) {
           const triggerIdx = currentData.length - 1 - step;
           const patternStartIdx = triggerIdx - pat.elements.length + 1;
           if (patternStartIdx < 0) continue;
           let isMatch = true;
           for (let p = 0; p < pat.elements.length; p++) {
             const r = currentData[patternStartIdx + p];
             const el = pat.elements[p];
             if (el.t === 'c') { if (!isColorMatch(getCol(r), el.v as string)) { isMatch = false; break; } } 
             else { if (r.roll.toString() !== el.v.toString()) { isMatch = false; break; } }
           }
           if (isMatch) {
             let alreadyHit = false;
             for (let check = 1; check <= step; check++) {
               if (evaluateHit(currentData[patternStartIdx + pat.elements.length - 1 + check], pat.target || targetFocus, config.coverWhite !== false)) {
                 alreadyHit = true; break;
               }
             }
             if (!alreadyHit) {
               activeNow = true;
               currentStep = step;
               break; 
             }
           }
         }
         return { ...pat, activeNow, currentStep };
      });
      
      finalResults.sort((a, b) => {
          if (a.activeNow && !b.activeNow) return -1;
          if (!a.activeNow && b.activeNow) return 1;
          if (config.sortBy === 'SA') {
            if (b.sa !== a.sa) return b.sa - a.sa;
            return parseFloat(b.winRate) - parseFloat(a.winRate);
          }
          return parseFloat(b.winRate) - parseFloat(a.winRate);
        });
      
      self.postMessage({ results: finalResults.slice(0, 100), anyNewTrigger: false });
    };

    execute();
  };

self.onmessage = (e: MessageEvent) => {
  const { action, config, currentData, isAuto, liveMode } = e.data;
  const oldActiveIds = new Set<string>(e.data.oldActiveIdsArray || []);

  if (action === 'runFullDiscoveryCiclo' || action === 'runFullDiscoveryEntrada' || action === 'runMixedDiscoveryEntrada') {
      runFullDiscoveryCiclo(config, currentData, isAuto, oldActiveIds);
  }
};