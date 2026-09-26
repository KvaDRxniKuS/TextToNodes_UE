# Tools

Каталог содержит CLI-скрипты генерации/проверки и `openai-tools.json` с JSON Schema для function/tool calling.

`openai-tools.json` — только описания интерфейсов. Наличие schema не означает, что соответствующая операция или asset type реализованы в репозитории. Фактические возможности ищите в исходниках конкретного инструмента.

## Основные CLI

- `node tools/make-node.mjs ...` — конструктор Blueprint-модулей. Запустите без спецификаций, чтобы увидеть синтаксис из комментария в скрипте.
- `node tools/gen-sweep.mjs` — пересобирает категорийные пробы и manifest; аргумент `zz` обновляет только `sweep/MANIFEST.md`, числовой префикс пересобирает соответствующую категорию.
- `node tools/gen-dispatcher-bound-test.mjs` — создаёт dispatcher layout fixture.
- `node tools/inventory.mjs <dump.txt> -o <context.json>` — строит инвентарь Blueprint-контекста для validate/make-node.

Новые генераторы строить отдельными этапами: [`src/creator.js`](../src/creator.js) → [`src/arranger.js`](../src/arranger.js) → [`src/decorator.js`](../src/decorator.js). См. [`docs/LAYOUT_PIPELINE.md`](../docs/LAYOUT_PIPELINE.md).
