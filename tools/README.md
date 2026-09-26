# Tools

Каталог содержит CLI-скрипты генерации/проверки и `openai-tools.json` с JSON Schema для function/tool calling.

`openai-tools.json` — только описания интерфейсов. Наличие schema не означает, что соответствующая операция или asset type реализованы в репозитории. Фактические возможности ищите в исходниках конкретного инструмента.

## Основные CLI

- `node tools/make-node.mjs ...` — конструктор Blueprint-модулей. Запустите без спецификаций, чтобы увидеть синтаксис из комментария в скрипте.
- `node tools/gen-sweep.mjs` — пересобирает категорийные пробы и manifest; аргумент `zz` обновляет только `sweep/MANIFEST.md`, числовой префикс пересобирает соответствующую категорию.
- `node tools/gen-dispatcher-bound-test.mjs` — создаёт dispatcher layout fixture.
- `node tools/gen-current-pipeline-smoke.mjs` — создаёт короткий Custom Event → Delay → PrintString пример через creator → arranger → decorator.
- `node tools/gen-three-stage-test.mjs [--stage N] [--report] [--check]` — прогон трёх ступеней РАЗДЕЛЬНЫМИ инструментами на эталонной спеке `tests/three-stage-01.sequence.md`: каждая ступень пишет свой copy-paste файл (`tests/three-stage-01.stageN-*.txt`), вход следующей — выход предыдущей как текст. `--check` сверяет файлы с генератором (входит в `npm test`).
- `node tools/inventory.mjs <dump.txt> -o <context.json>` — строит инвентарь Blueprint-контекста для validate/make-node.

Новые генераторы строить отдельными этапами: ступень 1 — [`src/stage1.js`](../src/stage1.js) (генератор нод поверх [`src/creator.js`](../src/creator.js)), ступень 2 — [`src/arranger.js`](../src/arranger.js), ступень 3 — [`src/decorator.js`](../src/decorator.js). См. [`docs/LAYOUT_PIPELINE.md`](../docs/LAYOUT_PIPELINE.md). `make-node` использует общий разбор спек из `src/stage1.js` (`buildSpecNode`), но раскладку — legacy-путём.
