#!/usr/bin/env node
// tools/check-sweep.mjs — воспроизводимость всего sweep/ (раньше назывался check-fixtures).
// Каждый сгенерированный txt пересобирается своим генератором и сравнивается побайтово с репозиторием:
// страховка от «тихого дрейфа» (реестр/генератор правят, а файлы остаются старыми).
//
//   node tools/check-sweep.mjs          — сверка (при расхождении — откат файлов, exit 1)
//   node tools/check-sweep.mjs --report — только таблица покрытия, без пересборки
//
// Папки sweep/ (подробно — sweep/README.md):
// • registry/  — сетка по категориям реестра + MANIFEST (tools/gen-sweep.mjs --check, в памяти);
// • chapters/  — связные главы раундов (свои генераторы/recipes; часть заморожена, см. FROZEN);
// • probes/    — ТОЛЬКО пробы, ждущие вердикта (tools/gen-probe.mjs --batch NN); после --register файл удаляется:
//                его ноды уже в registry/, а сама проба воспроизводится `gen-probe --batch NN --stdout`;
// • layout/    — тесты раскладки (collapsed-knot, pipeline-smoke);
// • copyback/  — ДОСЛОВНЫЕ копии из движка (эталоны). Не генерируются; tests/validate прогоняет их через STRICT.
// Новый файл в sweep/ без recipe и вне FROZEN/registry/copyback — провал проверки.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
const SELF_CHECKED = (f) => f.startsWith('sweep/registry/') || f.startsWith('sweep/copyback/') || f === 'sweep/README.md';

// [подпись, [cmd, ...args], [файлы, которые генератор пишет]]
const RECIPES = [
  ['registry/ — категории реестра + MANIFEST', ['node', 'tools/gen-sweep.mjs', '--check'], null],
  ['21b/21c — Enhanced Input (цепочка, ассеты)', ['node', 'tools/gen-r21-enhanced-input.mjs'], ['sweep/chapters/r21-enhanced-input-chain.txt', 'sweep/chapters/r21-enhanced-input-assets.txt']],
  ['22b — Cast к любому классу', ['node', 'tools/gen-cast.mjs', '--demo'], ['sweep/chapters/r22-cast-any.txt']],
  ['23b — Actor/SceneComponent досылка', ['bash', 'tools/recipes/r23-actor-ext.sh'], ['sweep/chapters/r23-actor-ext.txt']],
  ['25 — события и делегаты', ['node', 'tools/gen-r25-events.mjs'], ['sweep/chapters/r25-events-delegates.txt']],
  ['26 — таймеры и latent', ['node', 'tools/gen-r26-timers.mjs'], ['sweep/chapters/r26-timers-latent.txt']],
  ['27b — Widgets/UI, make-node --decorate', ['bash', 'tools/recipes/r27-widgets-ui-decorated.sh'], ['sweep/chapters/r27-widgets-ui-decorated.txt']],
  ['30 — декор переносов на узлах R26', ['bash', 'tools/recipes/r30-decorate.sh'], ['sweep/chapters/r30-decorate.txt']],
  ['32 — компоненты: lifecycle/запросы', ['bash', 'tools/recipes/r32-components-lifecycle.sh'], ['sweep/chapters/r32-components-lifecycle.txt']],
  ['enum-select — Enum Select по копии из UE', ['node', 'tools/gen-enum-select.mjs'], ['sweep/chapters/enum-select.txt']],
  ['collapsed-knot 4×5 (2 уровня)', ['node', 'tools/gen-collapsed-knot.mjs'], ['sweep/layout/collapsed-knot-4x5.txt']],
  ['collapsed-knot 1×3 (3 уровня)', ['node', 'tools/gen-collapsed-knot.mjs', '--inputs', '1', '--outputs', '3', '--levels', '3'], ['sweep/layout/collapsed-knot-1x3-3levels.txt']],
  ['current-pipeline smoke', ['node', 'tools/gen-pipeline-smoke.mjs'], ['sweep/layout/pipeline-smoke.txt']],
  ['dispatcher bound probe', ['node', 'tools/gen-dispatcher-bound.mjs'], ['sweep/chapters/dispatcher-bound.txt']],
  ['R40 — спец-ноды K2 (проба, ждёт вердикта)', ['node', 'tools/gen-r40-probe.mjs'], ['sweep/probes/r40-probe.txt']],
];

// Сверяются с движком вручную и не имеют генератора — только читать, не пересобирать.
const FROZEN = [
  'sweep/chapters/r25-make-node.txt',   // VERIFIED 2026-09-26: первый модуль make-node, подтверждён цельным copy-back
  'sweep/chapters/r31-audio.txt',        // VERIFIED: звук/аудио-компоненты, правки только через copy-back
  'sweep/chapters/r27-widgets-ui.txt',          // глава R27 — собрана до того, как её содержимое попало в реестр
  'sweep/chapters/r28-enhanced-input-full.txt', // глава R28: InputAction-ассеты + CustomEvent SetupInput
  'sweep/chapters/r29-components-physics.txt',  // глава R29: damping-вызовы, в реестре их нет
];

const read = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p)) : null);

if (process.argv.includes('--report')) {
  const genBy = new Map();
  for (const [label, cmd, files] of RECIPES) {
    if (!files) { genBy.set('sweep/registry/MANIFEST.md', label); continue; }
    files.forEach(f => genBy.set(f, label));
  }
  console.log('Пересобирается генератором:');
  RECIPES.forEach(([label, cmd]) => console.log(`  ✓ ${label}  →  ${cmd.join(' ')}`));
  console.log('Заморожено (copy-back из движка):');
  FROZEN.forEach(f => console.log(`  = ${f}`));
  const all = walk('sweep').filter(f => f.endsWith('.txt') || f.endsWith('.md')).sort();
  const bucket = (f) => FROZEN.includes(f) ? 'frozen' : genBy.has(f) || SELF_CHECKED(f) ? 'gen' : 'stray';
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
  console.log(`✗ ${label} — файл не совпадает с генератором:`);
  bad.forEach(([f, why]) => console.log(`    ${f}: ${why}`));
  for (const [f, bytes] of before) if (bytes) fs.writeFileSync(path.join(ROOT, f), bytes);
  console.log('    (файлы откачены к содержимому репозитория; пересборка — команды выше, затем diff и коммит)');
}

const covered = new Set(FROZEN);
for (const [, , files] of RECIPES) (files || []).forEach(f => covered.add(f));
const stray = walk('sweep').filter(f => (f.endsWith('.txt') || f.endsWith('.md')) && !covered.has(f) && !SELF_CHECKED(f));
if (stray.length) {
  drift++;
  console.log(`✗ файлы sweep/ без recipe и не в FROZEN: ${stray.join(', ')} — добавьте их в tools/check-sweep.mjs`);
}

console.log(`\nSWEEP: сверено ${ok + drift} генераторов, расхождений ${drift}${stray.length ? `, без recipe ${stray.length}` : ''}`);
process.exit(drift ? 1 : 0);
