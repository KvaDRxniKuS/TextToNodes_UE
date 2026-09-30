# Tools

Каталог содержит CLI-скрипты генерации и проверки. Интерфейс для нейросетей — `mcp/server.js` (MCP: generate/parse/validate/search) и `prompt/system-prompt.md`.

## Основные CLI

- `node tools/make-node.mjs ...` — конструктор Blueprint-модулей. Запустите без спецификаций, чтобы увидеть синтаксис из комментария в скрипте.
- `node tools/gen-sweep.mjs` — пересобирает категорийные пробы и manifest; аргумент `zz` обновляет только `sweep/registry/MANIFEST.md`, числовой префикс пересобирает соответствующую категорию.
- `node tools/gen-probe.mjs [--batch 36] [--check]` — пробы новых нод для проверки в UE: у каждой ноды открытый пузырь-комментарий с её названием (`bCommentBubbleVisible` + `NodeComment`). Пишет `sweep/<batch>-probe.txt`; пользователь присылает copy-back только неудачных нод. Пакеты — объект `BATCHES` в скрипте. `--register` (после вердикта «встали») заводит пробы в `data/ue-functions.json` (`verified`, поле `probe`), сверяя, что запись воспроизводит ноду пробы; затем `node tools/gen-sweep.mjs`.
- `node tools/gen-dispatcher-bound.mjs` — создаёт dispatcher layout fixture.
- `node tools/gen-pipeline-smoke.mjs` — создаёт короткий Custom Event → Delay → PrintString пример через creator → arranger → decorator.
- `node tools/gen-three-stage-test.mjs [--stage N] [--report] [--check]` — прогон трёх ступеней РАЗДЕЛЬНЫМИ инструментами на эталонной спеке `tests/three-stage-01.sequence.md`: ступень 1 пишет только код нод (без координат и проводов), ступень 2 материализует соединения и раскладывает черновик со knot-переносами, ступень 3 выравнивает пины. Каждая ступень отдаёт свой copy-paste файл `tests/three-stage-01.stageN-*.txt`, вход следующей — выход предыдущей как текст. `--report` — таблица нод/пинов/закладок и координат по ступеням, `--check` — побайтовая сверка файлов с генератором (входит в `npm test`).
- `node tools/inventory.mjs <dump.txt> -o <context.json>` — строит инвентарь Blueprint-контекста для validate/make-node.

Новые генераторы строить отдельными этапами: ступень 1 — [`src/stage1.js`](../src/stage1.js) (генератор нод поверх [`src/creator.js`](../src/creator.js)), ступень 2 — [`src/arranger.js`](../src/arranger.js), ступень 3 — [`src/decorator.js`](../src/decorator.js). См. [`docs/LAYOUT_PIPELINE.md`](../docs/LAYOUT_PIPELINE.md). `make-node` использует общий разбор спек из `src/stage1.js` (`buildSpecNode`), но раскладку — legacy-путём.

## Проверки ступеней

В `npm test` входят: `gen-three-stage-test.mjs --check` (ступени 1–2) и `check-knot-corridor.mjs`
по фикстуре ступени 2. `check-decoration.mjs` — проверка приостановленной ступени 3, запускается
вручную после `npm run stages:wip`.

- `node tools/check-decoration.mjs [вход(ступень 2)] [выход(ступень 3)] [зазор]` — ⚠ ступень 3 в
  разработке; критерии приёмки декоратора по тексту: **A** — Y exec-нод одного ряда идентичен (ряд — плоская лента), **B** — дети
  узла с несколькими использованными exec-выходами стоят в столбце (`X = правый край родителя +
  зазор`), **C** — зазор между соседями ряда ≥ 5 клеток (80), **D** — каждый несоосный exec-провод
  ведёт стадиум из 4 knot'ов с парным Y (вердикт 2026-09-28: K1·K2 на строке пина-выхода, K3·K4 на
  строке пина-входа, между ними соосная вертикаль; для межуровневого переноса она в свободной
  колонке, для внутриврядного knot'ы умещаются в щель между нодами), **E** — наложений нет,
  **F** — состав уровня, его верх и код нод не изменились.
- `node tools/check-knot-corridor.mjs [файл ступени 2]` — текстовый контроль переносов назад (входит в
  `npm test`, по умолчанию — фикстура ступени 2). Цепочка восстанавливается через knot'ы (`flatLinks`):
  ровно 4 knot'а; K1 на пине-выходе; K2 под K1 на линии щели не выше низа источника; K2·K3 на одной
  линии; K3·K4 в одной колонке; K4 на строке входа; вертикаль в свободной колонке; ни один knot не внутри ноды.
Пробы, не входящие в `npm test` (пересобирают фикстуры основного цикла без декоратора):
`gen-pipeline-smoke.mjs`, `gen-dispatcher-bound.mjs`, `gen-collapsed-knot.mjs`,
`gen-enum-select.mjs`, series-генераторы `gen-k/l/m/n/o-*`.

## Детерминизм sweep-корпуса

- `node tools/gen-sweep.mjs [--check] [NN]` — категории реестра → `sweep/NN-<slug>.txt` +
  `MANIFEST.md`. `--check` сверяет байты, ничего не записывая; `NN` — точечная пересборка
  категории. `seedGuids('sweep:<имя файла>')` ставится **до** построения узлов, поэтому частичный
  и полный прогон дают один и тот же файл.
- `node tools/check-sweep.mjs [--report]` — пересобирает каждую фикстуру `sweep/` её генератором
  и сравнивает байты; при расхождении печатает дельту и **откатывает** файлы (git status остаётся
  чистым). Входит в `npm test` (`npm run check:sweep`). Новый `.txt` в `sweep/` без recipe в
  `RECIPES` или без внесения в `FROZEN` — провал проверки.
- `tools/make-node.mjs` — seed по имени `-o` (фикстуры `27b`/`30`/`32` воспроизводимы); `--seed=`
  переопределяет, вывод в stdout остаётся на `Math.random`, чтобы разные blueprint'ы не делили GUID.
- Замороженные файлы (правятся только copy-back из UE): `r25-make-node.txt`, `r31-audio.txt`,
  `r27-widgets-ui.txt`, `r28-enhanced-input-full.txt`, `r29-components-physics.txt`. В `gen-sweep.mjs`
  они стоят в `HAND_OWNED`/`FROZEN` — автоматическая сборка их не перезаписывает (MANIFEST
  печатает ⊘ в колонке Notes).
