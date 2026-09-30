# TextToNodes_UE

Набор JavaScript-инструментов и браузерная песочница для чтения, создания, проверки и экспорта текста Blueprint в формате Unreal Engine `Begin Object … End Object`.

Проект помогает собирать Blueprint-графы из существующих типов нод и функций из реестра, просматривать текст и проверять структурные ошибки. **STRICT-валидатор не заменяет проверку вставкой и компиляцией в Unreal Editor**: движок остаётся источником истины для корректности сериализации и визуального расположения.

## Возможности

- Парсер UE Blueprint Text и экспорт графа обратно в текст/JSON: `src/parser.js`.
- Фабрики узлов и пинов, подключение связей: `src/creator.js`, `src/modules.js`, `src/generator.js`.
- Реестр функций и типов: `data/ue-functions.json`, `src/ue-types.js`.
- Строгая структурная проверка: `src/validate.js`.
- MCP server: `mcp/server.js`.
- Регрессии и образцы copy-back: `tests/`.

## Три этапа построения графа

Каждый этап — отдельный инструмент; этапы обмениваются текстом `Begin Object … End Object`, поэтому их можно применять по отдельности и сверять между собой (эталон: [`tests/three-stage-01.sequence.md`](tests/three-stage-01.sequence.md), прогон `npm run stages`).

**Основной цикл — ступени 1 и 2.** Ступень 3 (декоратор) с 2026-09-28 помечена «в разработке»:
код и проверки на месте, но в цикл она не входит, `positionBlueprint()` её не вызывает, а её
выход не коммитится (`npm run stages:wip` → `tests/three-stage-01.stage3-decorator.WIP.txt`).

1. **Создание — creator (`src/stage1.js` поверх `src/creator.js`).** Генератор нод: по спеке (ноды, соединения пинов, марки `@row/@col`) пишет **только код нод** — классы, пины, значения по умолчанию. Он не двигает ноды (`NodePosX/NodePosY = 0`) и не соединяет их (ни одного `LinkedTo`): расположение и соединения только закладываются и проверяются, а материализует их расстановщик (`applyConnections` + `arrangeRows`).
2. **Расстановка — arranger.** `src/arranger.js` располагает ряды, соблюдает заданную последовательность и зазоры, материализует провода и кладёт reroute-knot'ы: любой несоосный exec-провод (обратный перенос, перенос между уровнями или излом строк пинов в ряду) собирается из 4 knot'ов-стадиума, где каждый участок соосен пину (`transferRoute` + `execCorridorY`).
3. **Декорирование — decorator (⚠ в разработке, вне основного цикла).** `src/decorator.js` доводит черновик: Y exec-нод одного ряда идентичен (ряд — плоская лента), дети узла с несколькими exec-выходами встают столбцом, зазор по X = 5 клеток сетки (80 при grid 16), а любой несоосный exec-провод (перенос между уровнями или излом строк пинов в ряду) собирается из 4 knot'ов-стадиума, где каждый участок соосен пину. Ноды, провода и состав уровней ступень 3 не меняет. Ширина нод и координаты pin centers оцениваются моделью; их нужно сверять в редакторе.

`src/layout-pipeline.js` экспортирует этапы и orchestration-функцию `positionBlueprint()` — она
прогоняет ступень 2; декоратор включается только явно: `positionBlueprint(nodes, { decorate: { … } })`. Подробности и пример API: [`docs/LAYOUT_PIPELINE.md`](docs/LAYOUT_PIPELINE.md).

## Быстрый старт

Требуется Node.js, совместимый с ES modules.

```bash
npm test
node src/validate.js sweep/chapters/dispatcher-bound.txt
```

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

`data/ue-functions.json` — актуальный перечень функций, используемый парсером/генераторами и sweep. Поле `verified` означает, что запись подтверждена вставкой в UE; `note` сохраняет оговорку. Сводка регрессионного прогона: [`sweep/registry/MANIFEST.md`](sweep/registry/MANIFEST.md). Подробные copy-back-наблюдения и исторические тесты: [`docs/ENGINE_VERIFIED.md`](docs/ENGINE_VERIFIED.md).

Добавление строки в реестр само по себе **не доказывает**, что UE примет ноду. Подтверждение делается в нужной версии UE через вставку, copy-back и, где применимо, компиляцию Blueprint.

## Проверки

```bash
npm test                         # unit/regression tests + сверка sweep-корпуса
node src/validate.js FILE.txt    # STRICT check одного файла
node tools/gen-sweep.mjs         # пересобрать корпус sweep и MANIFEST
node tools/gen-sweep.mjs --check # побайтовая сверка sweep/NN-*.txt с генератором (без записей)
node tools/gen-sweep.mjs 11      # пересобрать только категорию 11
node tools/check-sweep.mjs    # пересобрать ВСЕ файлы sweep/ и сравнить байты (при дрейфе — откат)
node tools/check-sweep.mjs --report   # чем пересобран каждый файл, что заморожено
node tools/gen-dispatcher-bound.mjs
```

- `sweep/copyback/` содержит дословные copy-back из движка (эталоны).
- `tests/negative/` содержит примеры, которые валидатор обязан отклонять.
- `sweep/` — корпус проб и категорийный регресс. Он **воспроизводим**: GUID сеятся именем файла
  (`seedGuids`), поэтому `node tools/gen-sweep.mjs --check` и `node tools/check-sweep.mjs`
  ловят любой дрейф реестра/генератора, не порождая шума в diff. Полная таблица «чем пересобран
  каждый файл» — в `sweep/registry/MANIFEST.md` (раздел «Покрытие»); замороженные copy-back-главы
  (`25b`, `31-audio`, `27`, `28`, `29`) пересборке не подлежат — их правят только через copy-back из UE.
- `tools/make-node.mjs` сеится от `-o` (повторная сборка фикстуры = те же байты); в stdout GUID
  остаются случайными, `--seed=<строка>` задаёт seed вручную.

## MCP

Для сервера требуется пакет `@modelcontextprotocol/sdk` (см. импорты `mcp/server.js`). Инструкции подключения: [`mcp/README.md`](mcp/README.md).

## Документы

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — фактические границы и data flow проекта.
- [`docs/LAYOUT_PIPELINE.md`](docs/LAYOUT_PIPELINE.md) — обязанности трёх этапов.
- [`docs/HANDOFF.md`](docs/HANDOFF.md), [`docs/HANDOFF_TOPICS.md`](docs/HANDOFF_TOPICS.md) — актуальное состояние и очередь открытых тем.
- [`docs/ENGINE_VERIFIED.md`](docs/ENGINE_VERIFIED.md) — журнал подтверждений в Unreal Editor; ранние секции исторические.

Лицензия: MIT (файл `LICENSE` удалён как заглушка; текст лицензии по запросу).
