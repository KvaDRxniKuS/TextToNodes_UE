#!/usr/bin/env node
/**
 * Текстовый контроль геометрии knot-переносов (ступень 2 и 3).
 *
 * Требование пользователя: перенос собирается из 4 knot'ов-стадиума, и горизонтальный
 * участок переноса (средние knot'ы, у которых общий Y) обязан лежать В ЩЕЛИ между
 * уровнями — не внутри верхнего уровня, не под нижним. Для совместимости принимается
 * и старая «пара» (2 knot'а): у неё общий Y и есть горизонтальный участок.
 *
 * Использование:
 *   node tools/check-knot-corridor.mjs [tests/three-stage-01.stage2-arranger.txt]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToGraphs } from '../src/parser.js';
import { estNodeWidth, estNodeHeight } from '../src/generator.js';
import { isKnot, flatLinks, buildLevels, KNOT_W } from '../src/decorator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'tests/three-stage-01.stage2-arranger.txt');
const nodes = parseToGraphs(fs.readFileSync(file, 'utf8')).EventGraph.nodes;
const real = nodes.filter(n => !isKnot(n));
const knots = nodes.filter(isKnot);
const levels = buildLevels(real);
const levelOf = new Map();
levels.forEach((l, i) => l.nodes.forEach(n => levelOf.set(n.id, i)));

console.log(`${path.relative(ROOT, file)} — knot'ов: ${knots.length}, уровней: ${levels.length}`);
levels.forEach((l, i) => console.log(`  уровень ${i}: Y ${l.top}…${l.bottom}  [${l.nodes.map(n => n.id.split('_').slice(-1)[0]).join(', ')}]`));

// горизонтальный участок переноса: максимальная группа соседних knot'ов с одинаковым Y
function runOf(chain) {
  let best = [];
  for (let i = 0; i < chain.length; i++) {
    let j = i;
    while (j + 1 < chain.length && chain[j + 1].pos.y === chain[i].pos.y) j++;
    if (j > i && j - i + 1 > best.length) best = chain.slice(i, j + 1);
  }
  return best;
}

let bad = 0, checked = 0;
for (const l of flatLinks(nodes).filter(x => x.via.length)) {
  const run = runOf(l.via);
  const a = run[0], b = run[run.length - 1];
  checked++;
  if (!run.length) { bad++; console.log(`  ✗ ${l.source.id} → ${l.target.id}: knot'ы без горизонтального участка (${l.via.map(k => `${k.pos.x},${k.pos.y}`).join(' → ')})`); continue; }
  const ls = levelOf.get(l.source.id), lt = levelOf.get(l.target.id);
  if (ls === undefined || lt === undefined || ls === lt) {
    console.log(`  · ${l.source.id} → ${l.target.id}: тот же уровень (${ls}) — щель не требуется, участок y=${a.pos.y}`);
    continue;
  }
  const down = lt > ls;
  const [lo, hi] = down
    ? [Math.max(...levels.slice(ls, lt).map(x => x.bottom)), levels[lt].top]
    : [levels[lt].bottom, Math.min(...levels.slice(lt + 1, ls + 1).map(x => x.top))];
  const inGap = a.pos.y >= Math.min(lo, hi) && a.pos.y <= Math.max(lo, hi);
  const underTarget = down ? a.pos.y >= levels[lt].bottom : a.pos.y <= levels[lt].top;
  const insideSource = down ? a.pos.y <= levels[ls].bottom : a.pos.y >= levels[ls].top;
  const ok = inGap && !underTarget && !insideSource;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} перенос ${l.source.id}.${l.out.name} → ${l.target.id}.${l.input.name}: `
    + `knot'ов ${l.via.length}, горизонталь ${Math.min(a.pos.x, b.pos.x)}…${Math.max(a.pos.x, b.pos.x)} на y=${a.pos.y}, `
    + `щель между уровнями ${ls}→${lt}: ${lo}…${hi}`
    + `${underTarget ? ' [под целевым уровнем]' : ''}${insideSource ? ' [внутри уровня источника]' : ''}`);
}
// knot'ы не должны попадать внутрь прямоугольников нод (центр knot'а — его середина)
for (const k of knots) {
  const cx = k.pos.x + KNOT_W / 2, cy = k.pos.y + KNOT_W / 2;
  const inside = real.find(n => cx > n.pos.x && cx < n.pos.x + estNodeWidth(n) && cy > n.pos.y && cy < n.pos.y + estNodeHeight(n));
  if (inside) { bad++; console.log(`  ✗ ${k.id} (${k.pos.x},${k.pos.y}) попал внутрь ноды ${inside.id}`); }
}
if (!knots.length) console.log('  knot-переносов нет — проверять нечего');
console.log(bad ? `ИТОГ: нарушений ${bad} (переносов ${checked})` : `ИТОГ: коридор между уровнями соблюдён (переносов ${checked})`);
process.exit(bad ? 1 : 0);
