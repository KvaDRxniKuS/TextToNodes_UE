// R40: пробник спец-нод K2 (Timeline, Interface Message, AI MoveTo, GetDataTableRow,
// UserDefinedStruct Make/Break/SetFields, Set by-ref) + 4 latent-функции стрим-уровней.
// Каждая нода — с открытым пузырём комментария. Координаты — простая сетка для вставки,
// связей нет (генератор не соединяет).  node tools/gen-r40-probe.mjs [--stdout]
import fs from 'fs';
import { seedGuids, generateUEText } from '../src/parser.js';
import { createFromEntry } from '../src/generator.js';
import * as S from '../src/special-nodes.js';
seedGuids('r40-probe');
const reg = JSON.parse(fs.readFileSync(new URL('../data/ue-functions.json', import.meta.url)));
const MINMAX = { path: '/Game/S_MinMax.S_MinMax', name: 'S_MinMax', fields: [
  { prop: 'Min_2_EBEA736F4F5353411DE64DA77B073688', friendly: 'Min', category: 'real', sub: 'double', def: '0.000000' },
  { prop: 'Max_4_F17EB5CA4D1B0850DB46E8B266416830', friendly: 'Max', category: 'real', sub: 'double', def: '0.000000' } ] };
const items = [
  p => S.createTimeline({ pos: p, timelineName: 'Timeline', bubble: 'Timeline (K2Node_Timeline). Кривые — в TimelineTemplate BP' }),
  p => S.createInterfaceMessage({ pos: p, bpiPath: '/Game/Blueprints/BPI_Simulated.BPI_Simulated_C', memberName: 'I_Step', memberGuid: 'EFC4F66B406B8BC6DEABCDA221C5C0CB',
         params: [{ name: 'StepTime', category: 'real', sub: 'double', def: '0.0' }], bubble: 'Interface Message I_Step (BPI_Simulated)' }),
  p => S.createAIMoveTo({ pos: p, bubble: 'AI MoveTo (AIGraph.K2Node_AIMoveTo)' }),
  p => S.createGetDataTableRow({ pos: p, bubble: 'Get Data Table Row (без таблицы: wildcard Out Row)' }),
  p => S.createMakeUserStruct({ pos: p, struct: MINMAX, bubble: 'Make S_MinMax (UserDefinedStruct)' }),
  p => S.createSetFieldsInUserStruct({ pos: p, struct: MINMAX, bubble: 'Set members in S_MinMax' }),
  p => S.createBreakUserStruct({ pos: p, struct: MINMAX, bubble: 'Break S_MinMax (UserDefinedStruct)' }),
  p => S.createVariableSetRef({ pos: p, bubble: 'Set by-ref (K2Node_VariableSetRef)' }),
  ...['LoadStreamLevel', 'LoadStreamLevelBySoftObjectPtr', 'UnloadStreamLevel', 'UnloadStreamLevelBySoftObjectPtr'].map(id => p => {
    const e = reg.find(x => x.id === id); const n = createFromEntry(e, p); n.bubble = `${e.title} (GameplayStatics, latent)`; return n; }),
];
const nodes = items.map((f, i) => f({ x: (i % 4) * 400, y: Math.floor(i / 4) * 400 }));
const text = generateUEText(nodes, { root: 'BP_AISupportTester' }) + '\n';
if (process.argv.includes('--stdout')) process.stdout.write(text);
else { fs.writeFileSync(new URL('../sweep/probes/r40-probe.txt', import.meta.url), text); console.log('sweep/probes/r40-probe.txt · узлов', nodes.length); }
