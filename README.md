# TextToNodes_UE

Набор JavaScript-инструментов и браузерная песочница для чтения, создания, проверки и экспорта текста Blueprint в формате Unreal Engine `Begin Object … End Object`.

Проект помогает собирать Blueprint-графы из существующих типов нод и функций из реестра, просматривать текст и проверять структурные ошибки. **STRICT-валидатор не заменяет проверку вставкой и компиляцией в Unreal Editor**: движок остаётся источником истины для корректности сериализации и визуального расположения.

## Возможности

- Парсер UE Blueprint Text и экспорт графа обратно в текст/JSON: `src/parser.js`.
- Фабрики узлов и пинов, подключение связей: `src/creator.js`, `src/modules.js`, `src/generator.js`.
- Реестр функций и типов: `data/ue-functions.json`, `src/ue-types.js`.
- Строгая структурная проверка: `src/validate.js`.
- Браузерная песочница: `index.html`.
- MCP server: `mcp/server.js`.
- Регрессии и образцы copy-back: `tests/`.

## Три этапа построения графа

1. **Создание — creator.** Создаются типы узлов, имена, пины и двусторонние связи. `linkPins()` только записывает связь и не меняет координаты.
2. **Расстановка — arranger.** `src/arranger.js` располагает ряды, соблюдает заданную последовательность и зазоры; обратные exec-связи могут быть проложены через созданные reroute-knot узлы.
3. **Декорирование — decorator.** `src/decorator.js` корректирует координаты по связанным пинам, оставляет место для проводов и привязывает расположение к сетке 16 UE units. Ширина нод и координаты pin centers оцениваются моделью; их нужно сверять в редакторе.

`src/layout-pipeline.js` экспортирует этапы и orchestration-функцию `positionBlueprint()`. Подробности и пример API: [`docs/LAYOUT_PIPELINE.md`](docs/LAYOUT_PIPELINE.md).

## Быстрый старт

Требуется Node.js, совместимый с ES modules.

```bash
npm test
node src/validate.js sweep/dispatcher-probe-bound.txt
```

Открыть песочницу можно напрямую через `index.html` либо локальным сервером:

```bash
npx serve .
```

При `file://` браузер может блокировать загрузку `data/ue-functions.json`; тогда используется встроенный fallback snapshot (239 записей). Через HTTP-сервер загружается актуальный реестр (сейчас 406 записей).

Основные операции песочницы: вставить UE-текст, распарсить граф, просмотреть его, экспортировать текст или JSON. Проверьте функциональность в Unreal Editor перед использованием в проекте.

## Программный API

```js
import { parseToGraphs, generateUEText, generateJSON } from './src/parser.js';
import { createCallFunction, linkPins } from './src/creator.js';
import { positionBlueprint } from './src/layout-pipeline.js';
import { validateStrict } from './src/validate.js';

const first = createCallFunction(registryEntryA);
const second = createCallFunction(registryEntryB);
linkPins(first, 'then', second, 'execute');
const { nodes } = positionBlueprint([first, second], {
  rows: [[first, second]],
  arrange: { gap: 160 },
});
const text = generateUEText(nodes);
const result = validateStrict(text);
if (result.errors.length) throw new Error(result.errors.join('\n'));
const graph = parseToGraphs(text);
const json = generateJSON(nodes);
```

Ряды лучше задавать явно для графов с ветвлением, независимыми событиями, несколькими связями данных или несколькими execution inputs. `arrangeFlow()` предоставляет простую topological-оценку порядка, но не заменяет семантическое решение при сложной схеме.

## `make-node` CLI

```bash
node tools/make-node.mjs --chain --decorate -o /tmp/graph.txt \
  "event Start" "fn Delay Duration=1.0" "fn PrintString InString=Done"
```

Параметры/спеки `make-node` выводит при запуске без спецификаций. `tools/README.md` и комментарии в `tools/make-node.mjs` описывают текущий CLI. Флаг `--decorate` использует совместимый прежний layout path; новые генераторы должны подключать `creator → arranger → decorator` из модулей выше.

## Реестр и engine verification

`data/ue-functions.json` — актуальный перечень функций, используемый парсером/генераторами и sweep. Поле `verified` означает, что запись подтверждена вставкой в UE; `note` сохраняет оговорку. Сводка регрессионного прогона: [`sweep/MANIFEST.md`](sweep/MANIFEST.md). Подробные copy-back-наблюдения и исторические тесты: [`docs/ENGINE_VERIFIED.md`](docs/ENGINE_VERIFIED.md).

Добавление строки в реестр само по себе **не доказывает**, что UE примет ноду. Подтверждение делается в нужной версии UE через вставку, copy-back и, где применимо, компиляцию Blueprint.

## Проверки

```bash
npm test                         # unit/regression tests
node src/validate.js FILE.txt    # STRICT check одного файла
node tools/gen-sweep.mjs         # пересобрать sweep и MANIFEST целиком
node tools/gen-sweep.mjs zz      # обновить только MANIFEST
node tools/gen-dispatcher-bound-test.mjs
```

- `tests/fixtures/` содержит положительные реальные copy-back fixtures.
- `tests/fixtures/negative/` содержит примеры, которые валидатор обязан отклонять.
- `sweep/` содержит генерируемые пробы/категорийные fixtures; см. их генераторы перед перезаписью.

## MCP

Для сервера требуется пакет `@modelcontextprotocol/sdk` (см. импорты `mcp/server.js`). Инструкции подключения: [`mcp/README.md`](mcp/README.md).

## Документы

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — фактические границы и data flow проекта.
- [`docs/LAYOUT_PIPELINE.md`](docs/LAYOUT_PIPELINE.md) — обязанности трёх этапов.
- [`docs/HANDOFF.md`](docs/HANDOFF.md), [`docs/HANDOFF_TOPICS.md`](docs/HANDOFF_TOPICS.md) — актуальное состояние и очередь открытых тем.
- [`docs/ENGINE_VERIFIED.md`](docs/ENGINE_VERIFIED.md) — журнал подтверждений в Unreal Editor; ранние секции исторические.

Лицензия: MIT (`LICENSE`).
