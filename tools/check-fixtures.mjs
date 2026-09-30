#!/usr/bin/env node
// Проверка воспроизводимости sweep-корпуса: каждая фикстура пересобирается своим генератором
// и сравнивается побайтово с тем, что лежит в репозитории. Это страховка от «тихого дрейфа»:
// реестр/генератор правят, а зафиксированные txt остаются с прошлыми GUID и координатами,
// после чего тесты проверяют уже не то, что выдаёт инструмент.
//
//   node tools/check-fixtures.mjs          — сверка (при расхождении — откат файлов, exit 1)
//   node tools/check-fixtures.mjs --report — только таблица покрытия, без пересборки
//
// Правила:
// • sweep/MANIFEST.md и 01…29 — генерируются tools/gen-sweep.mjs; его режим --check сверяет их
//   в памяти, без записей (быстрый путь).
// • Прочие фикстуры пересобираются IN PLACE: перед прогоном байты запоминаются, при расхождении
//   файл возвращается к исходному содержимому (git status остаётся чистым).
// • Замороженные фикстуры (сверенные с движком copy-back, генератора в репозитории нет) не
//   трогаются; они перечислены в FROZEN и в sweep/MANIFEST.md. Новый txt в sweep/ без recipe
//   и без внесения в FROZEN — это провал проверки: покрытие обязано оставаться полным.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const IGNORE = new Set(['30-debug.txt']);   // диагностический вывод gen-sweep, не в git

// [подпись, [cmd, ...args], [файлы, которые генератор пишет]]
const RECIPES = [
  ['sweep 01…29 + MANIFEST (30 категорий реестра)', ['node', 'tools/gen-sweep.mjs', '--check'], null],
  ['21b/21c — Enhanced Input (цепочка, ассеты)', ['node', 'tools/gen-r21b.mjs'], ['sweep/21b-enhanced-input-chain.txt', 'sweep/21c-enhanced-input-assets.txt']],
  ['22b — Cast к любому классу', ['node', 'tools/gen-cast.mjs', '--demo'], ['sweep/22b-cast-any.txt']],
  ['23b — Actor/SceneComponent досылка', ['bash', 'sweep/gen23b.sh'], ['sweep/23b-actor-ext.txt']],
  ['25 — события и делегаты', ['node', 'tools/gen-r25.mjs'], ['sweep/25-events-delegates.txt']],
  ['26 — таймеры и latent', ['node', 'tools/gen-r26.mjs'], ['sweep/26-timers-latent.txt']],
  ['27b — Widgets/UI, make-node --decorate', ['bash', 'sweep/gen27b.sh'], ['sweep/27b-widgets-ui-decorated.txt']],
  ['30 — декор переносов на узлах R26', ['bash', 'sweep/gen30.sh'], ['sweep/30-decorate.txt']],
  ['32 — компоненты: lifecycle/запросы', ['bash', 'sweep/gen32.sh'], ['sweep/32-components-lifecycle.txt']],
  ['36 — пробы новых нод (пузыри-комментарии)', ['node', 'tools/gen-probe.mjs', '--batch', '36'], ['sweep/36-probe.txt']],
  ['38 — пробы новых нод R38', ['node', 'tools/gen-probe.mjs', '--batch', '38'], ['sweep/38-probe.txt']],
  ['enum-select — Enum Select по копии из UE', ['node', 'tools/gen-enum-select-test.mjs'], ['sweep/enum-select-test.txt']],
  ['collapsed-knot 4×5 (2 уровня)', ['node', 'tools/gen-collapsed-knot-test.mjs'], ['sweep/collapsed-knot-4x5-test.txt']],
  ['collapsed-knot 1×3 (3 уровня)', ['node', 'tools/gen-collapsed-knot-test.mjs', '--inputs', '1', '--outputs', '3', '--levels', '3'], ['sweep/collapsed-knot-1x3-3levels-test.txt']],
  ['current-pipeline smoke', ['node', 'tools/gen-current-pipeline-smoke.mjs'], ['sweep/current-pipeline-smoke.txt']],
  ['dispatcher bound probe', ['node', 'tools/gen-dispatcher-bound-test.mjs'], ['sweep/dispatcher-probe-bound.txt']],
];

// Сверяются с движком вручную и не имеют генератора — только читать, не пересобирать.
const FROZEN = [
  'sweep/25b-make-node.txt',   // VERIFIED 2026-09-26: первый модуль make-node, подтверждён цельным copy-back
  'sweep/31-audio.txt',        // VERIFIED: звук/аудио-компоненты, правки только через copy-back
  'sweep/27-widgets-ui.txt',          // глава R27 — собрана до того, как её содержимое попало в реестр
  'sweep/28-enhanced-input-full.txt', // глава R28: InputAction-ассеты + CustomEvent SetupInput
  'sweep/29-components-physics.txt',  // глава R29: damping-вызовы, в реестре их нет
];

const read = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p)) : null);

if (process.argv.includes('--report')) {
  const genBy = new Map();
  for (const [label, cmd, files] of RECIPES) {
    if (!files) { genBy.set('sweep/MANIFEST.md', label); continue; }
    files.forEach(f => genBy.set(f, label));
  }
  console.log('Пересобирается генератором:');
  RECIPES.forEach(([label, cmd]) => console.log(`  ✓ ${label}  →  ${cmd.join(' ')}`));
  console.log('Заморожено (copy-back из движка):');
  FROZEN.forEach(f => console.log(`  = ${f}`));
  const all = fs.readdirSync(path.join(ROOT, 'sweep'))
    .filter(f => (f.endsWith('.txt') || f.endsWith('.md')) && !IGNORE.has(f)).sort();
  const cat = (f) => /^\d\d-[\w-]+\.txt$/.test(f);          // категории — их сверяет gen-sweep --check
  const bucket = (f) => (FROZEN.includes('sweep/' + f) ? 'frozen'
    : genBy.has('sweep/' + f) || f === 'MANIFEST.md' || (cat(f) && !genBy.has('sweep/' + f)) ? 'gen' : 'stray');
  const by = { gen: [], frozen: [], stray: [] };
  for (const f of all) by[bucket(f)].push(f);
  console.log(`\nфайлов в sweep/: ${all.length} → пересобирается: ${by.gen.length}, заморожено: ${by.frozen.length}${by.stray.length ? `, БЕЗ RECIPE: ${by.stray.length}` : ''}`);
  console.log(by.stray.length ? `⚠ без recipe и не в FROZEN: ${by.stray.join(', ')}` : 'Покрытие полное ✓');
  process.exit(0);
}

let drift = 0, ok = 0;
for (const [label, cmd, files] of RECIPES) {
  const before = files ? files.map(f => [f, read(f)]) : null;
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding: 'utf8' });
  if (!files) {                                   // gen-sweep --check сам сравнивает и докладывает
    const out = (r.stdout || '') + (r.stderr || '');
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
    if (r.status === 0) { ok++; console.log(`✓ ${label}  ${lines.slice(-1)[0] || ''}`); }
    else { drift++; console.log(`✗ ${label}`); lines.slice(-4).forEach(l => console.log('    ' + l)); }
    continue;
  }
  const bad = [];
  for (const [f, bytes] of before) {
    const now = read(f);
    if (!bytes) { bad.push([f, 'нет в репозитории']); continue; }
    if (!now) { bad.push([f, 'генератор ничего не записал']); continue; }
    if (bytes.equals(now)) continue;
    const dl = (a, b) => { const s = new Set(a.toString().split('\n')), t = new Set(b.toString().split('\n')); return `−${[...s].filter(x => !t.has(x)).length} +${[...t].filter(x => !s.has(x)).length} строк`; };
    bad.push([f, dl(bytes, now)]);
  }
  if (!bad.length) { ok++; console.log(`✓ ${label}`); continue; }
  drift++;
  console.log(`✗ ${label} — фикстура не совпадает с генератором:`);
  bad.forEach(([f, why]) => console.log(`    ${f}: ${why}`));
  for (const [f, bytes] of before) if (bytes) fs.writeFileSync(path.join(ROOT, f), bytes);
  console.log('    (файлы откачены к содержимому репозитория; пересборка — команды выше, затем diff и коммит)');
}

const covered = new Set(FROZEN);
for (const [, , files] of RECIPES) (files || []).forEach(f => covered.add(f));
const stray = fs.readdirSync(path.join(ROOT, 'sweep'))
  .filter(f => (f.endsWith('.txt') || f.endsWith('.md')) && !IGNORE.has(f))
  .filter(f => !covered.has('sweep/' + f) && !(/^\d/.test(f) && f.endsWith('.txt')) && f !== 'MANIFEST.md');
if (stray.length) {
  drift++;
  console.log(`✗ фикстуры без recipe и не в FROZEN: ${stray.join(', ')} — добавьте их в tools/check-fixtures.mjs`);
}

console.log(`\nFIXTURES: сверено ${ok + drift} генераторов, расхождений ${drift}${stray.length ? `, без recipe ${stray.length}` : ''}`);
process.exit(drift ? 1 : 0);
