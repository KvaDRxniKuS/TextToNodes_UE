#!/usr/bin/env node
// tools/gen-three-stage-test.mjs — тестовый прогон трёх ступеней РАЗДЕЛЬНЫМИ инструментами.
//
//   node tools/gen-three-stage-test.mjs                # ОСНОВНОЙ ЦИКЛ: ступени 1 и 2
//   node tools/gen-three-stage-test.mjs --stage 2      # только ступень 2 (вход — файл ступени 1)
//   node tools/gen-three-stage-test.mjs --stage 3      # отдельно: декоратор (В РАЗРАБОТКЕ)
//   node tools/gen-three-stage-test.mjs --check        # перегенерировать и сверить с репозиторием
//   node tools/gen-three-stage-test.mjs --report       # таблица координат по ступеням
//
// Ступень 3 (декоратор) с 2026-09-28 в разработке и в основной цикл не входит: её прогон
// пишется в `tests/<base>.stage3-decorator.WIP.txt` (файл не коммитится) и сверяется только
// по `--stage 3`.
//
// Ступени связаны ТЕКСТОМ (как в рабочем процессе: файл скопировал → инструмент применил):
//   1 генератор нод  src/stage1.js    спека → ТОЛЬКО код нод: ни координат, ни проводов,
//                                    ни knot'ов/комментов; марки и соединения только заложены
//   2 расстановщик   src/arranger.js  код ступени 1 + заложенные марки/соединения →
//                                    материализует связи, черновая расстановка, knot-переносы
//   3 декоратор      src/decorator.js код ступени 2 → выравнивание пинов, зазор, knot'ы
//                                    ⚠ В РАЗРАБОТКЕ — применяется только по явномy `--stage 3`
//
// GUID детерминированы (seedGuids по имени теста): перегенерация не создаёт шума в diff'е,
// а ступени можно сверять побайтово.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateUEText, parseToGraphs, seedGuids } from '../src/parser.js';
import { validateStrict } from '../src/validate.js';
import { createStage1Graph, describeStage1, parseSpec, rowsFromMarks } from '../src/stage1.js';
import { applyConnections, arrangeRows } from '../src/arranger.js';
import { decorateLayout } from '../src/decorator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.TTNN_BASE || 'three-stage-01';
const SPEC_FILE = path.join(ROOT, 'tests', `${BASE}.sequence.md`);
const OUT = {
  1: path.join(ROOT, 'tests', `${BASE}.stage1-generator.txt`),
  2: path.join(ROOT, 'tests', `${BASE}.stage2-arranger.txt`),
  3: path.join(ROOT, 'tests', `${BASE}.stage3-decorator.WIP.txt`),
};
const STAGE_NAME = { 1: 'генератор нод (src/stage1.js)', 2: 'расстановщик (src/arranger.js)', 3: 'декоратор (src/decorator.js)' };

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const opt = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
const only = opt('stage') ? Number(opt('stage')) : 0;
// ступень 3 — только по явному запросу (в разработке), в основном прогоне её нет.
// Ключи OUT/FILES — строки («1», «2», «3»), поэтому сравниваем числами.
const run = key => { const n = Number(key); return n === 3 ? only === 3 : (only ? only === 3 || only === n : true); };

/** Спека = первый блок ```graph внутри .sequence.md (для .txt — весь файл). */
function readSpecGraph(file) {
  const text = fs.readFileSync(file, 'utf8');
  const block = text.match(/```graph\n([\s\S]*?)```/);
  if (block) return block[1];
  if (/\.md$/i.test(file)) throw new Error(`${file}: нет блока graph`);
  return text;
}

const blocksOf = t => new Map(parseToGraphs(t).EventGraph.nodes.map(n => [n.id, n]));
const posOf = n => `${n.pos.x},${n.pos.y}`;
const bodyOf = n => n.rawBlock.split(/\r?\n/).filter(l => !/^\s*Node(PosX|PosY)=/.test(l)).map(l => l.replace(/LinkedTo=\([^)]*\),?/g, '')).join('\n');

/** Ступень вправе менять ТОЛЬКО координаты; новые блоки — только knot'ы (ступень 2). */
function diffAgainstInput(inText, outText) {
  const before = blocksOf(inText), after = blocksOf(outText);
  const problems = [], unchanged = [];
  for (const [id, n] of after) {
    if (!before.has(id)) {
      if (!n.className.includes('Knot')) problems.push(`добавлена не-knot нода ${n.id} (${n.className})`);
      continue;
    }
    if (bodyOf(n) !== bodyOf(before.get(id))) problems.push(`${id}: изменён код ноды — ступень вправе править только координаты и LinkedTo`);
    if (posOf(n) === posOf(before.get(id))) unchanged.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) problems.push(`${id}: нода пропала на выходе ступени`);
  return { problems, unchanged };
}

/** STRICT + подсчёт блоков; возвращает накопленные ошибки (пусто = чисто). */
function checkText(label, text) {
  const v = validateStrict(text);
  const blocks = (text.match(/Begin Object/g) || []).length;
  console.log(`  ${label}: блоков=${blocks} STRICT errors=${v.errors.length} warnings=${v.warnings.length}`);
  v.errors.forEach(e => console.log(`     ERR ${e}`));
  v.warnings.forEach(w => console.log(`     WARN ${w}`));
  return { errors: v.errors.slice(), warnings: v.warnings.slice(), blocks };
}

function main() {
  const specGraph = readSpecGraph(SPEC_FILE);
  seedGuids(BASE);
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ue-functions.json'), 'utf8'));
  const spec = parseSpec(specGraph);
  const failures = [];

  // ── Ступень 1: генератор нод ────────────────────────────────────────────────
  const g1 = createStage1Graph(specGraph, { registry });
  const rows = rowsFromMarks(g1.nodes);
  if (run(1)) {
    failures.push(...g1.problems.map(p => `ступень 1: ${p}`));
    failures.push(...g1.validation.errors.map(e => `ступень 1 STRICT: ${e}`));
    failures.push(...g1.warnings.map(w => `ступень 1: ${w}`));
    console.log(`Ступень 1 — ${STAGE_NAME[1]}`);
    console.log(`  узлов=${g1.nodes.length} · уровней заложено=${rows.length} · соединений заложено=${g1.connections.length}`
      + ` · координат=0 · проводов=0 · knot'ов=0 · комментов=0`);
    checkText(OUT[1], g1.text);
  }

  // ── Ступень 2: расстановщик (вход — ТЕКСТ ступени 1) ───────────────────────
  const stage1Text = run(2) && only === 2 && fs.existsSync(OUT[1]) ? fs.readFileSync(OUT[1], 'utf8') : g1.text;
  const marks = new Map(g1.nodes.map(n => [n.id, n.mark]));
  const parsed = parseToGraphs(stage1Text).EventGraph.nodes.filter(n => !n.isComment);
  parsed.forEach((n, i) => { n.mark = marks.get(n.id) || { row: 0, col: i }; });
  // ступень 2 превращает заложенные соединения в провода (двусторонние LinkedTo) — до раскладки
  const wired = applyConnections(parsed, g1.connections);
  const s2rows = rowsFromMarks(parsed).map(r => r.nodes);
  const arr = arrangeRows(s2rows, { x: 0, y: 0, gap: spec.settings.gap ?? 160, rowGap: spec.settings.rowGap ?? 160, createRerouteKnots: true });
  const stage2Text = generateUEText(arr.nodes, { syncLinks: true }) + '\n';
  if (run(2)) {
    const d = diffAgainstInput(stage1Text, stage2Text);
    failures.push(...d.problems.map(p => `ступень 2: ${p}`));
    console.log(`Ступень 2 — ${STAGE_NAME[2]}`);
    console.log(`  узлов=${arr.nodes.length} (knot'ов создано ${arr.knots.length}) рядов=${s2rows.length} проводов проложено=${wired.length}${d.unchanged.length ? ` · без сдвига: ${d.unchanged.length} шт` : ''}`);
    checkText(OUT[2], stage2Text);
  }

  // ── Ступень 3: декоратор (вход — ТЕКСТ ступени 2) ──────────────────────────
  const stage2In = run(3) && only === 3 && fs.existsSync(OUT[2]) ? fs.readFileSync(OUT[2], 'utf8') : stage2Text;
  const decNodes = parseToGraphs(stage2In).EventGraph.nodes.filter(n => !n.isComment);
  const dec = run(3)
    ? decorateLayout(decNodes, { clearance: spec.settings.clearance ?? 5 * (spec.settings.grid ?? 16), grid: spec.settings.grid ?? 16 })
    : null;
  const stage3Text = dec ? generateUEText(dec.nodes, { syncLinks: true }) + '\n' : '';
  if (run(3)) {
    const d = diffAgainstInput(stage2In, stage3Text);
    failures.push(...d.problems.map(p => `ступень 3: ${p}`));
    console.log(`Ступень 3 — ${STAGE_NAME[3]} · В РАЗРАБОТКЕ, вне основного цикла`);
    console.log(`  узлов=${dec.nodes.length} knot'ов на входе=${decNodes.filter(n => /Knot/.test(n.className)).length}${d.unchanged.length ? ` · без сдвига: ${d.unchanged.length} шт` : ''}`);
    checkText(OUT[3], stage3Text);
  }

  if (flag('report')) printReport(g1, arr, dec);

  const files = { 1: g1.text, 2: stage2Text, 3: stage3Text };
  if (flag('check')) {
    for (const [n, text] of Object.entries(files)) {
      if (!run(n)) continue;
      const committed = fs.existsSync(OUT[n]) ? fs.readFileSync(OUT[n], 'utf8') : '';
      if (committed.trim() !== text.trim()) failures.push(`ступень ${n}: ${path.relative(ROOT, OUT[n])} расходится с генератором — перегенери`);
      else console.log(`  ✓ ${path.relative(ROOT, OUT[n])} совпадает с генератором`);
    }
  } else {
    for (const [n, text] of Object.entries(files)) {
      if (!run(n)) continue;
      fs.writeFileSync(OUT[n], text.endsWith('\n') ? text : text + '\n');
      console.log(`  → записан ${path.relative(ROOT, OUT[n])} (${text.length} байт)`);
    }
  }

  if (failures.length) {
    console.log(`\n✗ ${failures.length} проблем:`);
    failures.forEach(f => console.log('  ! ' + f));
    process.exit(1);
  }
  console.log("\n✓ Проверки ступеней чистые: STRICT, round-trip, «ступень трогает только координаты и LinkedTo»,"
    + " ступень 1 — без координат, проводов, knot'ов и комментов."
    + (run(3) ? '' : "  (ступень 3 — в разработке, вне цикла; прогон: --stage 3)"));
}

function printReport(g1, arr, dec) {
  const arrById = new Map(arr.nodes.map(n => [n.id, n]));
  const decById = new Map((dec?.nodes || []).map(n => [n.id, n]));
  const pad = (s, w) => String(s).padEnd(w);
  console.log('\nСтупень 1 — ноды, пины и ЗАЛОЖЕННЫЕ соединения (⚬ = пин без заложенного соединения; код нод при этом чист: без координат и проводов)');
  for (const d of describeStage1(g1)) {
    console.log(`  #${pad(d.index, 3)} ${pad(d.id, 34)} ${pad(`row=${d.row} col=${d.col}`, 16)} ${d.pins.join(' ')}`);
    for (const l of d.lays) console.log(`        закладка: ${l}`);
  }
  console.log('\nКоординаты по ступеням (1 = марки, 2 = черновая расстановка, 3 = пины/сетка):');
  for (const n of g1.nodes) {
    const a = arrById.get(n.id), d = decById.get(n.id);
    console.log(`  #${pad(n.mark.index, 3)}${pad(n.title, 34)}row=${pad(n.mark.row, 5)}col=${pad(n.mark.col, 4)}`
      + `| 1:(${pad(n.pos.x, 6)},${pad(n.pos.y, 5)}) 2:(${pad(a?.pos.x, 6)},${pad(a?.pos.y, 5)})`
      + (dec ? ` 3:(${pad(d?.pos.x, 6)},${d?.pos.y})` : ' 3:(WIP)'));
  }
  const knots = arr.nodes.filter(n => /Knot/.test(n.className));
  if (knots.length) {
    console.log(`  knot'ы (2 = коридор расстановщика${dec ? ', 3 = по пинам концов' : ''}):`);
    for (const k of knots) {
      const d = decById.get(k.id);
      console.log(`    ${k.id}: 2:(${k.pos.x},${k.pos.y})` + (dec ? ` 3:(${d?.pos.x},${d?.pos.y})` : ''));
    }
  }
  if (dec?.notes?.length) {
    console.log('  решения декоратора (что не стало ровняться и почему):');
    for (const note of dec.notes) console.log(`    · ${note}`);
  }
  const execLinks = [];
  for (const n of (dec ? dec.nodes : arr.nodes)) for (const p of n.pins) {
    if (p.direction !== 'Output') continue;
    for (const l of p.linkedTo) execLinks.push(`${n.id}.${p.name} → ${l.nodeName}`);
  }
  console.log(`  связей в финальном коде: ${execLinks.length}`);
}

main();
