// tools/gen-sweep.mjs — полный прогон реестра по категориям (sweep).
// Для каждой категории: все записи → узлы (createFromEntry) → сетка (ряды по COLS,
// внутри ряда layoutRow) → fitComment → validateStrict → sweep/NN-slug.txt.
// Упавшие записи (неизвестные struct/enum/lib) и strict-проблемы прогон не
// останавливают — уходят в sweep/MANIFEST.md (раздел NEEDS-REFERENCE).
// Запуск: node tools/gen-sweep.mjs            — пересобрать корпус
//         node tools/gen-sweep.mjs 11          — только категория 11 (точечная досылка)
//         node tools/gen-sweep.mjs --check      — сверить корпус с генератором (часть npm test)
// GUID детерминированы (seedGuids по имени файла), поэтому повторная сборка даёт побайтовое
// совпадение и `--check` ловит любой дрейф реестра/генератора без шума в diff'е.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateUEText, seedGuids } from '../src/parser.js';
import { createFromEntry, createComment, fitComment, estNodeWidth, ROW_GAP, PIN_ROW_H } from '../src/generator.js';
import { validateStrict } from '../src/validate.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'sweep');
const COLS = 5;   // узлов в ряду сетки
const ROW_DY = 120; // зазор между рядами

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/ue-functions.json'), 'utf8'));

// категории в порядке первого появления в реестре
const cats = [];
for (const e of reg) if (!cats.includes(e.category)) cats.push(e.category);

const slug = c => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const estH = n => 110 + PIN_ROW_H * ((n.pins && n.pins.length) || 0);
const wcode = w => w.slice(0, 3);

fs.mkdirSync(OUT, { recursive: true });

const report = [];
let totalOk = 0, totalFail = 0;

// Главы, чей txt принадлежит ручной компоновке (связная сцена, а не сетка категорий):
// gen-sweep считает по ним статистику для MANIFEST, но НЕ перезаписывает файл и исключает
// его из побайтовой сверки — иначе два генератора воюют за одно имя (исторически файл в git
// = версия ручной главы, её и проверяют тесты).
const HAND_OWNED = {
  '25-events-delegates.txt': 'tools/gen-r25.mjs',
  '26-timers-latent.txt': 'tools/gen-r26.mjs',
  '27-widgets-ui.txt': 'ручная глава R27 (сверена с движком) — генератора нет, файл заморожен',
  '28-enhanced-input-full.txt': 'ручная глава R28 (InputAction-ассеты, CustomEvent SetupInput) — заморожен',
  '29-components-physics.txt': 'ручная глава R29 (damping-вызовы вне реестра) — заморожен',
};
const CHECK = process.argv.slice(2).includes('--check');
const SCRATCH = new Set(['30-debug.txt']); // пишется для удобства, в git не попадает (`.gitignore`)
const written = [];   // { fname, text } — для режима --check
cats.forEach((cat, ci) => {
  const entries = reg.filter(e => e.category === cat);
  const fname = `${String(ci + 1).padStart(2, '0')}-${slug(cat)}.txt`;
  // seed ДО построения узлов: PinId/Guid зависят только от имени файла, поэтому точечная
  // пересборка категории (`11`) даёт те же байты, что и полная сборка
  seedGuids('sweep:' + fname);
  const nodes = [], failed = [];
  for (const e of entries) {
    try { nodes.push({ e, n: createFromEntry(e) }); }
    catch (err) { failed.push({ e, reason: err.message }); }
  }
  // сетка: ряды по COLS; шаг Y = макс. высота ряда + зазор
  let y = 0;
  for (let r = 0; r * COLS < nodes.length; r++) {
    const row = nodes.slice(r * COLS, r * COLS + COLS);
    let x = 0;
    for (const { n } of row) { n.pos.x = x; n.pos.y = y; x += estNodeWidth(n) + ROW_GAP; }
    y += Math.max(...row.map(({ n }) => estH(n))) + ROW_DY;
  }
  const all = nodes.map(({ n }) => n);
  const verified = entries.filter(e => e.verified).length;
  const head = `SWEEP ${String(ci + 1).padStart(2, '0')}/${cats.length}: ${cat} (${nodes.length}/${entries.length} узлов, ${verified} verified)`;
  const withComment = all.length ? [fitComment(head, all), ...all]
    : [createComment(head + ' — ПУСТО, все записи требуют референсов (см. MANIFEST)', { x: -60, y: -110 }, 900, 200)];
  const txt = generateUEText(withComment);
  const v = validateStrict(txt);
  // Фильтр argv[2] ("11", "11-collision"): точечная регенерация одной категории
  // после правки реестра — остальные txt не трогаем (без GUID-шума). MANIFEST
  // пересчитывается всегда.
  const owned = HAND_OWNED[fname];
  // в --check и в записи — только свои файлы; диагностический вывод вне git не сверяем
  // (иначе проверка падает на отсутствующем sweep/30-debug.txt, а он не в репозитории)
  if (!owned && !SCRATCH.has(fname)) written.push({ fname, text: txt + '\n' });
  const only = (process.argv[2] || '').toLowerCase();
  if (!CHECK && !owned && (!only || fname.toLowerCase().startsWith(only)))
    fs.writeFileSync(path.join(OUT, fname), txt + '\n');
  report.push({ cat, fname, entries, nodes: nodes.length, failed, verified, errors: v.errors, warnings: v.warnings, owned });
  totalOk += nodes.length; totalFail += failed.length;
  console.log(`${fname}: nodes=${nodes.length}/${entries.length} errors=${v.errors.length} warnings=${v.warnings.length}`);
  failed.forEach(f => console.log(`   FAIL ${f.e.id}: ${f.reason}`));
  v.errors.forEach(e => console.log('   ERR ' + e));
});

// ---- MANIFEST.md ----
const L = [];
L.push('# Sweep manifest — полный прогон реестра по категориям');
L.push('');
L.push(`Записей в реестре: ${reg.length}; построено узлов: ${totalOk}; упало: ${totalFail}.`);
L.push('MANIFEST и NN-*.txt побайтово воспроизводимы (дата не пишется): сверка — `node tools/gen-sweep.mjs --check`.');
L.push(`Генератор: tools/gen-sweep.mjs (сетка по ${COLS} в ряд, внутри ряда layoutRow, накрыто fitComment).`);
L.push('');
L.push('Протокол: вставляйте файлы по одному в чистый граф → копируйте обратно → сообщайте номер файла и что сломалось.');
L.push('Для сломанных нод прикладывайте copy-back целиком (пин Id не затирать) — по нему чиним реестр.');
L.push('');
L.push('Известные оговорки (не баги свипа):');
L.push('- 02-variables: VariableReference указывает на несуществующую переменную (MemberName из реестра, случайный MemberGuid) — движок подсветит неизвестную переменную, это ожидаемо; нужны референсы из BP с настоящими переменными.');
L.push('- MakeArray/MakeSet/MakeMap: форма смоделирована по механике типов контейнера; проверяйте в движке при использовании. Enum Select для EDrawDebugTrace использует отдельную копию из UE (sweep/enum-select-test.txt); не обобщать её на пользовательские enum без reference.');
L.push('- Макросы без GraphGuid (W07 в 01-flow-control): движок обычно прощает; guid доберём из copy-back.');
L.push('- W09: у записи есть note — вставляйте внимательнее, это зафиксированные сомнения.');
L.push('');
L.push('Колонка `Registry verified` буквально считает записи с `verified: true` в реестре; она не означает, что каждая запись категории была отдельно перепроверена в одном UE-сеансе. `Warn` — предупреждения локального валидатора.');
L.push('');
L.push('| # | Файл | Нод | Registry verified | Notes | Err | Warn |');
L.push('|---|---|---|---|---|---|---|');
report.forEach((r, i) => {
  const wc = {};
  r.warnings.forEach(w => { wc[wcode(w)] = (wc[wcode(w)] || 0) + 1; });
  const wsum = Object.entries(wc).map(([c, n]) => `${n}x${c}`).join(' ') || '—';
  const noteN = r.entries.filter(e => e.note).length;
  L.push(`| ${String(i + 1).padStart(2, '0')} | ${r.fname} | ${r.nodes}/${r.entries.length} | ${r.verified} | ${r.owned ? '⊘ ' + r.owned : noteN} | ${r.errors.length || '—'} | ${wsum} |`);
});
L.push('');
L.push('## Покрытие: чем пересобран каждый файл');
L.push('');
L.push('Все строки ниже побайтово воспроизводимы (`seedGuids` по имени файла), сверка — `node tools/check-fixtures.mjs`:');
L.push('');
L.push('| файлы | команда пересборки |');
L.push('|---|---|');
L.push('| NN-*.txt категорий реестра, MANIFEST.md | `node tools/gen-sweep.mjs` (одна категория: `node tools/gen-sweep.mjs 11`) — кроме файлов с ⊘ в колонке Notes |');
L.push('| 21b, 21c | `node tools/gen-r21b.mjs` |');
L.push('| 22b | `node tools/gen-cast.mjs --demo` |');
L.push('| 23b | `bash sweep/gen23b.sh` (gen-subset по 19 id реестра) |');
L.push('| 25, 26 | `node tools/gen-r25.mjs`, `node tools/gen-r26.mjs` (ручная компоновка глав, см. колонку Notes выше) |');
L.push('| 27b, 30, 32 | `bash sweep/gen27b.sh`, `bash sweep/gen30.sh`, `bash sweep/gen32.sh` (make-node; seed берётся из `-o`) |');
L.push('| enum-select-test | `node tools/gen-enum-select-test.mjs` |');
L.push('| collapsed-knot-4x5, collapsed-knot-1x3-3levels | `node tools/gen-collapsed-knot-test.mjs`, затем `--inputs 1 --outputs 3 --levels 3` |');
L.push('| current-pipeline-smoke, dispatcher-probe-bound | `node tools/gen-current-pipeline-smoke.mjs`, `node tools/gen-dispatcher-bound-test.mjs` |');
L.push('');
L.push('Заморожено — copy-back / ручные главы, сверенные с движком; генератора в репозитории нет, пересборка их перезаписывает — запрещено:');
L.push('- `25b-make-node.txt` (VERIFIED 2026-09-26), `31-audio.txt` (VERIFIED) — продукты `tools/make-node.mjs`, команда сборки не зафиксирована;');
L.push('- `27-widgets-ui.txt`, `28-enhanced-input-full.txt`, `29-components-physics.txt` — главы R27/R28/R29, собранные до того, как их содержимое попало в реестр (в нём нет, например, Set/GetAngularDamping, LinearDamping и CustomEvent SetupInput). Статистику по этим категориям MANIFEST считает по реестру, файл не трогает.');
L.push('');
L.push('Замороженные копии созданы до отказа от `ExportPath` — строки `ExportPath=...` в них сохранены намеренно (это снятые с движка тексты).');
L.push('');
L.push('## NEEDS-REFERENCE (не построилось — нужен copy-back из движка)');
L.push('');
if (!totalFail) L.push('Пусто — построилось всё.');
for (const r of report) for (const f of r.failed)
  L.push(`- ${r.fname} :: ${f.e.id} (${f.e.func || '—'}) — ${f.reason}`);
L.push('');
L.push('## STRICT-ошибки по файлам (наш валидатор; движок — арбитр)');
L.push('');
if (!report.some(r => r.errors.length)) L.push('Пусто.');
for (const r of report) for (const e of r.errors) L.push(`- ${r.fname} :: ${e}`);
L.push('');
L.push('## Варнинги по файлам (W09 = есть note в реестре, W07 = нет GraphGuid)');
L.push('');
if (!report.some(r => r.warnings.length)) L.push('Пусто.');
for (const r of report) for (const w of r.warnings) L.push(`- ${r.fname} :: ${w}`);
L.push('');
const manifestText = L.join('\n') + '\n';
// ── --check: побайтовая сверка корпуса и MANIFEST с генератором ──
if (CHECK) {
  const drift = [];
  for (const { fname, text } of written) {
    const file = path.join(OUT, fname);
    const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (committed.trim() !== text.trim()) drift.push(fname);
  }
  const committedManifest = fs.existsSync(path.join(OUT, 'MANIFEST.md'))
    ? fs.readFileSync(path.join(OUT, 'MANIFEST.md'), 'utf8') : '';
  if (committedManifest.trim() !== manifestText.trim()) drift.push('MANIFEST.md');
  if (drift.length) {
    console.log(`\n✗ sweep расходится с генератором (${drift.length}): ${drift.join(', ')}`);
    console.log('  пересборка: node tools/gen-sweep.mjs');
    process.exit(1);
  }
  console.log(`\n✓ sweep-корпус совпадает с генератором (категорий=${cats.length}, узлов=${totalOk})`);
  process.exit(0);
}
fs.writeFileSync(path.join(OUT, 'MANIFEST.md'), manifestText);
console.log(`\nSWEEP: categories=${cats.length} built=${totalOk} failed=${totalFail} → sweep/MANIFEST.md`);
