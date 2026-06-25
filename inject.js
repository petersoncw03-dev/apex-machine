const fs = require('fs');

const analistaFile = 'src/app/analista/page.tsx';
const novoBotFile = 'src/app/meus-robos/novo-bot/page.tsx';

let analista = fs.readFileSync(analistaFile, 'utf8');
let novoBot = fs.readFileSync(novoBotFile, 'utf8');

const analistaStartStr = '  const getNumNode = ';
const analistaEndStr = '  // Quick Trend Engine (Enhanced Scoring & Auto-Loader)';

const startIndex = analista.indexOf(analistaStartStr);
const endIndex = analista.indexOf(analistaEndStr);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find start or end index in analista/page.tsx');
    process.exit(1);
}

const discoveryLogic = analista.substring(startIndex, endIndex);

const novoBotStartStr = '  const checkTrend = (rolls: Roll[], trendConfig: any) => {';
const novoBotEndStr = '  const runQuickTrend = () => {';

const nbStart = novoBot.indexOf(novoBotStartStr);
const nbEnd = novoBot.indexOf(novoBotEndStr);

if (nbStart === -1 || nbEnd === -1) {
    console.error('Could not find start or end index in novo-bot/page.tsx');
    process.exit(1);
}

// In novoBot, we want to replace everything from checkTrend downwards until runQuickTrend, EXCEPT we need to keep checkTrend!
// Wait! checkTrend is in novo-bot, but does analista have checkTrend? NO.
// So we should replace from AFTER checkTrend definition until runQuickTrend.

const checkTrendEnd = novoBot.indexOf(';', novoBot.indexOf('return v1 < v2;\n    };\n  };')) + 1;

// Let's just find the start of runFullDiscovery in novo-bot to replace.
const oldDiscoveryStart = novoBot.indexOf('  const runFullDiscovery = ');

if (oldDiscoveryStart === -1) {
    console.error('Could not find runFullDiscovery in novo-bot');
    process.exit(1);
}

const newNovoBot = novoBot.substring(0, oldDiscoveryStart) + discoveryLogic + '\n' + novoBot.substring(nbEnd);

fs.writeFileSync(novoBotFile, newNovoBot, 'utf8');
console.log('Successfully injected discovery logic!');
