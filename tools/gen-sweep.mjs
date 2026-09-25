// tools/gen-sweep.mjs — полный прогон реестра по категориям (sweep).
// Для каждой категории: все записи → узлы (createFromEntry) → сетка (ряды по COLS,
// внутри ряда layoutRow) → fitComment → validateStrict → sweep/NN-slug.txt.
// Упавшие записи (неизвестные struct/enum/lib) и strict-проблемы прогон не
// останавливают — уходят в sweep/MANIFEST.md (раздел NEEDS-REFERENCE).
// Запуск: node tools/gen-sweep.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateUEText } from '../src/parser.js';
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

cats.forEach((cat, ci) => {
  const entries = reg.filter(e => e.category === cat);
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
  const fname = `${String(ci + 1).padStart(2, '0')}-${slug(cat)}.txt`;
  // Фильтр argv[2] ("11", "11-collision"): точечная регенерация одной категории
  // после правки реестра — остальные txt не трогаем (без GUID-шума). MANIFEST
  // пересчитывается всегда.
  const only = (process.argv[2] || '').toLowerCase();
  if (!only || fname.toLowerCase().startsWith(only))
    fs.writeFileSync(path.join(OUT, fname), txt + '\n');
  report.push({ cat, fname, entries, nodes: nodes.length, failed, verified, errors: v.errors, warnings: v.warnings });
  totalOk += nodes.length; totalFail += failed.length;
  console.log(`${fname}: nodes=${nodes.length}/${entries.length} errors=${v.errors.length} warnings=${v.warnings.length}`);
  failed.forEach(f => console.log(`   FAIL ${f.e.id}: ${f.reason}`));
  v.errors.forEach(e => console.log('   ERR ' + e));
});

// ---- MANIFEST.md ----
const L = [];
L.push('# Sweep manifest — полный прогон реестра по категориям');
L.push('');
L.push(`Дата: ${new Date().toISOString().slice(0, 10)}; записей: ${reg.length}; построено узлов: ${totalOk}; упало: ${totalFail}.`);
L.push(`Генератор: tools/gen-sweep.mjs (сетка по ${COLS} в ряд, внутри ряда layoutRow, накрыто fitComment).`);
L.push('');
L.push('Протокол: вставляйте файлы по одному в чистый граф → копируйте обратно → сообщайте номер файла и что сломалось.');
L.push('Для сломанных нод прикладывайте copy-back целиком (пин Id не затирать) — по нему чиним реестр.');
L.push('');
L.push('Известные оговорки (не баги свипа):');
L.push('- 02-variables: VariableReference указывает на несуществующую переменную (MemberName из реестра, случайный MemberGuid) — движок подсветит неизвестную переменную, это ожидаемо; нужны референсы из BP с настоящими переменными.');
L.push('- MakeArray/MakeSet/MakeMap/Select (19-organization): форма смоделирована механически (sub Array/Set/Map → ContainerType) — движок арбитр, ждём copy-back.');
L.push('- Макросы без GraphGuid (W07 в 01-flow-control): движок обычно прощает; guid доберём из copy-back.');
L.push('- W09: у записи есть note — вставляйте внимательнее, это зафиксированные сомнения.');
L.push('');
L.push('| # | Файл | Нод | Verified | Noted | Err | Warn |');
L.push('|---|---|---|---|---|---|---|');
report.forEach((r, i) => {
  const wc = {};
  r.warnings.forEach(w => { wc[wcode(w)] = (wc[wcode(w)] || 0) + 1; });
  const wsum = Object.entries(wc).map(([c, n]) => `${n}x${c}`).join(' ') || '—';
  L.push(`| ${String(i + 1).padStart(2, '0')} | ${r.fname} | ${r.nodes}/${r.entries.length} | ${r.verified} | ${r.entries.filter(e => e.note).length} | ${r.errors.length || '—'} | ${wsum} |`);
});
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
fs.writeFileSync(path.join(OUT, 'MANIFEST.md'), L.join('\n'));
console.log(`\nSWEEP: categories=${cats.length} built=${totalOk} failed=${totalFail} → sweep/MANIFEST.md`);
